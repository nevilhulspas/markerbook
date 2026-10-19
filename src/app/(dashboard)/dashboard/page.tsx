import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Activity, User } from 'lucide-react'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type { Biomarker } from '@/lib/database.types'
import type { BiomarkerWithRelations } from '@/actions/blood-tests'
import type { PanelSystemLookup } from '@/lib/grid/grid-types'
import {
  buildGridData,
  type GridEnrichment,
  type TestWithResults,
} from '@/lib/grid/build-grid-data'
import {
  calculatePhenoAge,
  checkPhenoAgeReadiness,
  PHENOAGE_MARKERS,
  type PhenoAgeInput,
} from '@/lib/analytics/phenoage'
import { convertValue } from '@/lib/grid/unit-conversion'
import { PhenoAgeCard } from '@/components/analytics/phenoage-card'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { throwIfAuthOutage } from '@/lib/supabase/auth-outage'
import { getRequestUser } from '@/lib/supabase/request-user'

export const metadata: Metadata = {
  title: 'Dashboard | Markerbook',
}

function computeAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  return age
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await getRequestUser()
  throwIfAuthOutage(user, authError)
  if (!user) redirect('/login')

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch all tests with results for grid data
  const { data: tests } = await supabase
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
    .order('test_date', { ascending: true })

  const testCount = tests?.length ?? 0

  // Fetch enriched biomarkers for unit conversion and panel data
  const { data: enrichedBiomarkers } = await supabase
    .from('biomarkers')
    .select('*, biomarker_units(*), reference_ranges(*), panels(*, systems(*))')
    .is('archived_at', null)

  // Build enrichment map
  const enrichmentMap: GridEnrichment = new Map()
  const allBiomarkersMap = new Map<string, Biomarker>()
  const panelLookup: PanelSystemLookup = { panels: new Map() }

  if (enrichedBiomarkers) {
    // Narrowing cast: the hand-written Biomarker/ReferenceRange types are stricter than the schema.
    for (const bm of enrichedBiomarkers as BiomarkerWithRelations[]) {
      enrichmentMap.set(bm.id, {
        units: bm.biomarker_units ?? [],
        ranges: bm.reference_ranges ?? [],
      })
      allBiomarkersMap.set(bm.id, bm)
      if (bm.panels && bm.panel_id && !panelLookup.panels.has(bm.panel_id)) {
        panelLookup.panels.set(bm.panel_id, {
          ...bm.panels,
          system: bm.panels.systems,
        })
      }
    }
  }

  // Build grid data (reuses pattern from grid/page.tsx). Narrowing cast: the
  // embedded biomarkers rows are stricter in the hand-written Biomarker type.
  const gridData = buildGridData(
    (tests ?? []) as TestWithResults[],
    profile?.sex,
    enrichmentMap,
    allBiomarkersMap,
    panelLookup.panels.size > 0 ? panelLookup : undefined
  )

  // Compute chronological age
  const chronologicalAge =
    profile?.date_of_birth ? computeAge(profile.date_of_birth) : null

  // Find the latest test ID (last in sorted-ascending array)
  const latestTestId =
    gridData.testDates.length > 0
      ? gridData.testDates[gridData.testDates.length - 1].id
      : null

  // Check PhenoAge readiness
  const readiness = latestTestId
    ? checkPhenoAgeReadiness(gridData.rows, latestTestId)
    : {
        ready: false,
        present: [],
        missing: PHENOAGE_MARKERS.map((m) => m.catalogName),
        presentCount: 0,
        totalRequired: PHENOAGE_MARKERS.length,
      }

  // Calculate PhenoAge if ready
  let phenoAge: number | null = null
  if (readiness.ready && chronologicalAge !== null && latestTestId) {
    const input: Partial<PhenoAgeInput> = { age: chronologicalAge }

    for (const marker of PHENOAGE_MARKERS) {
      const row = gridData.rows.find(
        (r) =>
          r.biomarker.name === marker.catalogName ||
          r.biomarker.short_name === marker.catalogName
      )

      if (row) {
        const cell = row.values[latestTestId]
        if (cell) {
          let value: number | null = cell.value
          // Convert to the unit the PhenoAge formula expects. If it can't be
          // converted, skip this marker — feeding the raw value in the wrong
          // unit would silently corrupt the result.
          value = convertValue(cell.value, cell.unit, marker.unit, row.units ?? [], {
            unit: row.biomarker.unit,
            loinc_code: row.biomarker.loinc_code,
            name: row.biomarker.name,
            molar_mass: row.biomarker.molar_mass,
            valence: row.biomarker.valence,
          })
          if (value !== null) {
            ;(input as Record<string, number>)[marker.key] = value
          }
        }
      }
    }

    const result = calculatePhenoAge(input as PhenoAgeInput)
    if (!isNaN(result) && isFinite(result)) {
      phenoAge = result
    }
  }

  // Profile completion check
  const profileFields = [
    profile?.date_of_birth,
    profile?.sex,
    profile?.height_cm,
    profile?.weight_kg,
  ]
  const profileCompleted = profileFields.filter(Boolean).length
  const profileTotal = profileFields.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s your health overview.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Blood Tests Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4" />
              Blood Tests
            </CardTitle>
            <CardDescription>
              {testCount === 0
                ? 'No tests recorded yet'
                : `${testCount} test${testCount === 1 ? '' : 's'} recorded`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {testCount === 0 ? (
              <p className="text-sm text-muted-foreground">
                Import your first blood test results to get started.
              </p>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href="/grid">
                  View marker grid
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Health Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-4" />
              Health Profile
            </CardTitle>
            <CardDescription>
              {profileCompleted === profileTotal
                ? 'Profile complete'
                : `${profileCompleted}/${profileTotal} fields completed`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/profile">
                {profileCompleted === profileTotal
                  ? 'View profile'
                  : 'Complete your profile'}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* PhenoAge Card */}
        <PhenoAgeCard
          chronologicalAge={chronologicalAge}
          phenoAge={phenoAge}
          readiness={readiness}
        />
      </div>
    </div>
  )
}
