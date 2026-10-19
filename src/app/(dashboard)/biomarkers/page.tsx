import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type {
  Biomarker,
  BiomarkerUnit,
  PanelWithSystem,
  ReferenceRange,
} from '@/lib/database.types'
import { BiomarkerTabs } from '@/components/biomarker/biomarker-tabs'
import { getLoincDisplayMap, resolveDisplay, loincFamilyKey } from '@/lib/loinc/display'
import { getFavoriteIds } from '@/actions/favorites'
import { getUnitPreferences } from '@/actions/unit-preferences'
import { getNextToTestLists } from '@/actions/next-to-test/lists'
import { getBiomarkerListMembership } from '@/actions/next-to-test/lookup'
import { throwIfAuthOutage } from '@/lib/supabase/auth-outage'
import { getRequestUser } from '@/lib/supabase/request-user'

export const metadata: Metadata = {
  title: 'Biomarkers | Markerbook',
}

interface CatalogBiomarker extends Biomarker {
  biomarker_units: BiomarkerUnit[]
  reference_ranges: ReferenceRange[]
  panels: PanelWithSystem | null
}

export default async function BiomarkersPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await getRequestUser()
  throwIfAuthOutage(user, authError)

  if (!user) redirect('/login')

  // Parallel fetch: full catalog + user's tested biomarker IDs with latest values
  const [catalogResult, userMarkersResult, profileResult, favoriteIds, unitPrefs] = await Promise.all([
    // No parent_id filter: grouping is derived from the LOINC component (see below),
    // not the legacy parent/child hierarchy, so every active marker is listed.
    supabase
      .from('biomarkers')
      .select('*, biomarker_units(*), reference_ranges(*), panels(*, systems(*))')
      .is('archived_at', null)
      .order('name'),
    supabase
      .from('test_results')
      .select(
        'biomarker_id, value, unit, blood_tests!inner(test_date, name)'
      )
      .eq('blood_tests.user_id', user.id)
      .order('blood_tests(test_date)', { ascending: false }),
    supabase.from('profiles').select('sex').eq('id', user.id).single(),
    getFavoriteIds(),
    getUnitPreferences(),
  ])

  // Narrowing cast: the hand-written Biomarker/ReferenceRange types are stricter than the schema.
  const catalog = (catalogResult.data ?? []) as CatalogBiomarker[]

  // LOINC display layer: prefer clean_name + abbreviation for on-screen names
  const loincDisplay = await getLoincDisplayMap(supabase, catalog.map((bm) => bm.loinc_code))

  // LOINC component families: a family label is shown only when 2+ active markers
  // share the same base component (e.g. Triiodothyronine -> Free/Total/Reverse T3).
  const familyCounts = new Map<string, number>()
  for (const bm of catalog) {
    const fam = loincFamilyKey(loincDisplay.get(bm.loinc_code ?? '')?.component)
    if (fam) familyCounts.set(fam, (familyCounts.get(fam) ?? 0) + 1)
  }

  // Only feeds the "add to list" picker: hide it rather than fail the page.
  const nextToTestLists = await getNextToTestLists().catch((err: unknown) => {
    console.error('[next-to-test] lists unavailable for the picker', err)
    return []
  })
  const biomarkerIds = catalog.map((bm) => bm.id)
  const nextToTestMembership =
    nextToTestLists.length > 0
      ? await getBiomarkerListMembership(biomarkerIds)
      : {}
  const userSex = profileResult.data?.sex === 'male' || profileResult.data?.sex === 'female'
    ? profileResult.data.sex
    : null

  // Build a map: biomarker_id -> latest test result
  const userMarkerMap = new Map<
    string,
    { value: number; unit: string; testDate: string; testName: string }
  >()
  if (userMarkersResult.data) {
    for (const row of userMarkersResult.data) {
      // First occurrence is most recent (ordered desc)
      if (!userMarkerMap.has(row.biomarker_id)) {
        userMarkerMap.set(row.biomarker_id, {
          value: row.value,
          unit: row.unit,
          testDate: row.blood_tests.test_date,
          testName: row.blood_tests.name,
        })
      }
    }
  }

  // Build serializable data for client component
  const catalogItems = catalog.map((bm) => {
    const userResult = userMarkerMap.get(bm.id)
    const display = resolveDisplay(bm, loincDisplay)
    const famKey = loincFamilyKey(loincDisplay.get(bm.loinc_code ?? '')?.component)
    const family = famKey && (familyCounts.get(famKey) ?? 0) >= 2 ? famKey : null
    return {
      id: bm.id,
      name: display.name,
      shortName: display.shortName,
      family,
      category: bm.category,
      unit: bm.unit,
      method: bm.method,
      panelName: bm.panels?.name ?? null,
      systemName: bm.panels?.systems?.name ?? null,
      hasUserData: !!userResult,
      isFavorite: favoriteIds.has(bm.id),
      availableUnits: bm.biomarker_units.map((u) => ({
        unit: u.unit,
        conversionFactor: u.conversion_factor,
      })),
      molarMass: bm.molar_mass != null ? Number(bm.molar_mass) : null,
      valence: bm.valence ?? null,
      latestValue: userResult?.value ?? null,
      latestUnit: userResult?.unit ?? null,
      latestDate: userResult?.testDate ?? null,
      latestTestName: userResult?.testName ?? null,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Biomarkers</h1>
        <p className="text-muted-foreground">
          Browse the biomarker catalog and view your tracked markers.
        </p>
      </div>

      <BiomarkerTabs
        items={catalogItems}
        userMarkerCount={userMarkerMap.size}
        userSex={userSex}
        unitPreferences={Array.from(unitPrefs.entries())}
        nextToTestLists={nextToTestLists.length > 0 ? nextToTestLists : undefined}
        nextToTestMembership={nextToTestMembership}
      />
    </div>
  )
}
