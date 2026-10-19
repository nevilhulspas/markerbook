import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import type { Biomarker, Profile } from '@/lib/database.types'
import { toClientProfile } from '@/lib/profile/client-profile'
import type { BiomarkerWithRelations } from '@/actions/blood-tests'
import { getAnalyzedTestIds } from '@/actions/interpretation'
import { getAnnotations } from '@/actions/annotations'
import { getSupplements } from '@/actions/supplements'
import { getUnitPreferences } from '@/actions/unit-preferences'
import type { PanelSystemLookup } from '@/lib/grid/grid-types'
import {
  buildGridData,
  type GridEnrichment,
  type TestWithResults,
} from '@/lib/grid/build-grid-data'
import { MarkerGrid } from '@/components/grid/marker-grid'
import { getLoincDisplayMap, resolveDisplay } from '@/lib/loinc/display'
import { Button } from '@/components/ui/button'
import { throwIfAuthOutage } from '@/lib/supabase/auth-outage'
import { getRequestUser } from '@/lib/supabase/request-user'

export const metadata: Metadata = {
  title: 'Marker Grid | Bloodmarkers',
}

export default async function GridPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await getRequestUser()
  throwIfAuthOutage(user, authError)
  if (!user) redirect('/login')

  // Independent reads, so fetch them together (they used to run one after
  // another). Only the LOINC display map below depends on the catalog.
  const [
    { data: tests, error: testsError },
    { data: profile },
    { data: enrichedBiomarkers, error: enrichError },
    analyzedTestIds,
    annotationsResult,
    supplementsResult,
    unitPreferences,
  ] = await Promise.all([
    // All the user's tests with results and biomarker data
    supabase
      .from('blood_tests')
      .select(
        `
      id, name, test_date, sample_type,
      test_results (
        id, value, unit,
        biomarkers ( * )
      )
    `
      )
      .order('test_date', { ascending: true }),
    // Profile for sex-specific ranges and AI personalization
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    // Enriched biomarker catalog (units + reference ranges)
    supabase
      .from('biomarkers')
      .select('*, biomarker_units(*), reference_ranges(*), panels(*, systems(*))')
      .is('archived_at', null),
    // Which tests have AI analysis cached
    getAnalyzedTestIds(),
    getAnnotations(),
    getSupplements(),
    getUnitPreferences(),
  ])

  // A failed read must not look like "no tests yet": show the error page
  // (with its retry button) instead of the empty state.
  if (testsError) {
    throw new Error(`Could not load your blood tests: ${testsError.message}`)
  }

  if (enrichError) {
    console.error('Failed to load enriched biomarkers:', enrichError.message)
  }

  // LOINC display layer: rewrite on-screen marker names to clean_name + abbreviation
  // (in place, at the source, so grid render/search/sort all stay consistent).
  type DisplayBm = { name: string; short_name: string | null; loinc_code?: string | null }
  const loincDisplay = await getLoincDisplayMap(
    supabase,
    ((enrichedBiomarkers ?? []) as DisplayBm[]).map((b) => b.loinc_code),
  )
  const applyLoincDisplay = (bm: DisplayBm | null | undefined) => {
    if (!bm) return
    const d = resolveDisplay(bm, loincDisplay)
    bm.name = d.name
    bm.short_name = d.shortName
  }
  for (const bm of (enrichedBiomarkers ?? []) as DisplayBm[]) applyLoincDisplay(bm)
  for (const t of tests ?? []) {
    for (const r of t.test_results ?? []) applyLoincDisplay(r.biomarkers)
  }

  // Build enrichment map: biomarker_id -> { units, ranges }
  const enrichmentMap: GridEnrichment = new Map()
  if (enrichedBiomarkers) {
    // Narrowing cast: the hand-written Biomarker/ReferenceRange types are stricter than the schema.
    for (const bm of enrichedBiomarkers as BiomarkerWithRelations[]) {
      enrichmentMap.set(bm.id, {
        units: bm.biomarker_units ?? [],
        ranges: bm.reference_ranges ?? [],
      })
    }
  }

  // Build full biomarker catalog map for sort lookups (parent name resolution)
  const allBiomarkersMap = new Map<string, Biomarker>()
  const panelLookup: PanelSystemLookup = { panels: new Map() }
  if (enrichedBiomarkers) {
    // Narrowing cast: the hand-written Biomarker/ReferenceRange types are stricter than the schema.
    for (const bm of enrichedBiomarkers as BiomarkerWithRelations[]) {
      allBiomarkersMap.set(bm.id, bm)
      // Build panel lookup from the joined panels->systems data
      if (bm.panels && bm.panel_id && !panelLookup.panels.has(bm.panel_id)) {
        panelLookup.panels.set(bm.panel_id, {
          ...bm.panels,
          system: bm.panels.systems,
        })
      }
    }
  }

  const annotations = annotationsResult.data ?? []
  const supplements = supplementsResult.data ?? []
  // Serialize Map for client component
  const unitPrefsArray = Array.from(unitPreferences.entries())

  // Narrowing cast: the embedded biomarkers rows are stricter in the hand-written Biomarker type.
  const gridData = buildGridData(
    (tests ?? []) as TestWithResults[],
    profile?.sex,
    enrichmentMap,
    allBiomarkersMap,
    panelLookup.panels.size > 0 ? panelLookup : undefined
  )

  // Extract unique categories sorted alphabetically for filter UI (case-insensitive dedup)
  const categoryMap = new Map<string, string>()
  for (const r of gridData.rows) {
    const key = r.category.toLowerCase()
    if (!categoryMap.has(key)) categoryMap.set(key, r.category)
  }
  const categories = Array.from(categoryMap.values()).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  )

  if (gridData.rows.length === 0) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            No blood tests yet
          </h2>
          <p className="mt-2 text-muted-foreground">
            Create your first blood test to see your markers in the grid.
          </p>
        </div>
        <Button asChild>
          <Link href="/tests/new">
            <Plus />
            Create First Test
          </Link>
        </Button>
      </div>
    )
  }

  return (
    // Fill the layout's scroll area exactly (h-full) so the page itself never
    // overflows — the grid below is the ONLY vertical scroller. Previously the
    // grid guessed its height (100vh - 260px) and on mobile, where the header
    // stack is taller than 260px, both the page AND the grid scrolled.
    <div className="flex h-full min-h-0 flex-col space-y-4">
      <div className="flex shrink-0 items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Marker Grid</h1>
      </div>
      <Suspense>
        <MarkerGrid
          rows={gridData.rows}
          testDates={gridData.testDates}
          categories={categories}
          userSex={profile?.sex}
          profile={toClientProfile((profile as Profile) ?? null)}
          analyzedTestIds={Array.from(analyzedTestIds)}
          annotations={annotations}
          supplements={supplements}
          unitPreferences={unitPrefsArray}
        />
      </Suspense>
    </div>
  )
}
