import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import type {
  Biomarker,
  BiomarkerUnit,
  PanelWithSystem,
  ReferenceRange,
} from '@/lib/database.types'
import { findReferenceRange } from '@/lib/grid/reference-range'
import type { TrendDataPoint } from '@/lib/analytics/marker-trends'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { MarkerContext, ProfileContext } from '@/lib/interpretation/types'
import { InterpretationContent } from '@/components/interpretation/interpretation-content'
import { RelatedMarkers } from '@/components/biomarker/related-markers'
import { ContextualInsight } from '@/components/biomarker/contextual-insight'
import { FavoriteButton } from '@/components/biomarker/favorite-button'
import { UnitConversionWrapper } from '@/components/biomarker/unit-conversion-wrapper'
import { getFavoriteIds } from '@/actions/favorites'
import { getUnitPreferences } from '@/actions/unit-preferences'
import { getLabsForBiomarker } from '@/actions/labs'
import { throwIfAuthOutage } from '@/lib/supabase/auth-outage'
import { notFoundOrAuthOutage } from '@/lib/supabase/session'
import { getRequestUser } from '@/lib/supabase/request-user'

export const metadata: Metadata = {
  title: 'Biomarker Detail | Bloodmarkers',
}

interface BiomarkerWithRelations extends Biomarker {
  biomarker_units: BiomarkerUnit[]
  reference_ranges: ReferenceRange[]
  panels: PanelWithSystem | null
}

interface TestResultRow {
  id: string
  value: number
  unit: string
  blood_tests: {
    id: string
    test_date: string
    name: string
  }
}

export default async function BiomarkerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await getRequestUser()
  throwIfAuthOutage(user, authError)

  if (!user) {
    redirect('/login')
  }

  // Parallel data fetching
  const [
    biomarkerResult,
    testResultsResult,
    profileResult,
    descriptionResult,
    favoriteIds,
    unitPrefs,
    labOfferingsResult,
  ] = await Promise.all([
      supabase
        .from('biomarkers')
        .select(
          '*, biomarker_units(*), reference_ranges(*), panels(*, systems(*))'
        )
        .eq('id', id)
        .single(),
      supabase
        .from('test_results')
        .select('id, value, unit, blood_tests!inner(id, test_date, name)')
        .eq('biomarker_id', id)
        .eq('blood_tests.user_id', user.id)
        .order('blood_tests(test_date)', { ascending: true }),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase
        .from('biomarker_descriptions')
        .select('*')
        .eq('biomarker_id', id)
        .maybeSingle(),
      getFavoriteIds(),
      getUnitPreferences(),
      getLabsForBiomarker(id),
    ])

  if (biomarkerResult.error || !biomarkerResult.data) {
    return notFoundOrAuthOutage()
  }

  // Narrowing cast: the hand-written Biomarker/ReferenceRange types are stricter than the schema.
  const biomarker = biomarkerResult.data as BiomarkerWithRelations
  const testResults: TestResultRow[] = testResultsResult.data ?? []
  const profile = profileResult.data
  const labOfferings = labOfferingsResult.data ?? []

  // Related markers query: same panel OR parent/child relationship
  const orFilters: string[] = []
  if (biomarker.panel_id) {
    orFilters.push(`panel_id.eq.${biomarker.panel_id}`)
  }
  orFilters.push(`parent_id.eq.${id}`)
  if (biomarker.parent_id) {
    orFilters.push(`id.eq.${biomarker.parent_id}`)
  }

  const { data: relatedMarkersData } = await supabase
    .from('biomarkers')
    .select('id, name, short_name, parent_id, panel_id')
    .or(orFilters.join(','))
    .neq('id', id)
    .is('archived_at', null)
    .limit(10)

  const relatedMarkers = (relatedMarkersData ?? []) as Array<{
    id: string
    name: string
    short_name: string | null
    parent_id: string | null
    panel_id: string | null
  }>

  // Child biomarkers (for parent-only biomarker detection)
  let childBiomarkers: Array<{
    id: string
    name: string
    short_name: string | null
  }> = []

  if (!biomarker.parent_id) {
    const { data: childData } = await supabase
      .from('biomarkers')
      .select('id, name, short_name')
      .eq('parent_id', id)
      .is('archived_at', null)

    childBiomarkers = (childData ?? []) as Array<{
      id: string
      name: string
      short_name: string | null
    }>
  }

  // Build trend data (original units — conversion is client-side)
  const sex =
    profile?.sex === 'male' || profile?.sex === 'female' ? profile.sex : null

  // Points for client-side conversion wrapper (original values)
  const points: TrendDataPoint[] = testResults.map((r) => ({
    date: r.blood_tests.test_date,
    value: r.value,
    testName: r.blood_tests.name,
    unit: r.unit,
    bloodTestId: r.blood_tests.id,
  }))

  const { low: refLow, high: refHigh } = findReferenceRange(
    biomarker.reference_ranges,
    biomarker.unit,
    sex
  )

  const latestResult = testResults.length > 0 ? testResults[testResults.length - 1] : null
  const latestDate = latestResult?.blood_tests.test_date ?? null

  const systemName = biomarker.panels?.systems?.name
  const panelName = biomarker.panels?.name

  const description = descriptionResult.data

  // Prepare ContextualInsight data
  const mappedTestResults = testResults.map((r) => ({
    id: r.id,
    value: r.value,
    unit: r.unit,
    date: r.blood_tests.test_date,
    testName: r.blood_tests.name,
    bloodTestId: r.blood_tests.id,
  }))

  const profileContext: ProfileContext = {
    dateOfBirth: profile?.date_of_birth ?? null,
    sex: profile?.sex ?? null,
    heightCm: profile?.height_cm ?? null,
    weightKg: profile?.weight_kg ?? null,
    activityLevel: profile?.activity_level ?? null,
  }

  // Fetch cross-marker context for the latest test (needed for contextual insight)
  let allMarkersForLatestTest: MarkerContext[] = []
  if (testResults.length > 0) {
    const latestBloodTestId = testResults[testResults.length - 1].blood_tests.id
    const { data: allResults } = await supabase
      .from('test_results')
      .select('value, unit, biomarkers!inner(name, short_name, category)')
      .eq('blood_test_id', latestBloodTestId)

    if (allResults) {
      allMarkersForLatestTest = allResults.map((r) => ({
        name: r.biomarkers.name,
        shortName: r.biomarkers.short_name,
        value: r.value,
        unit: r.unit,
        category: r.biomarkers.category,
        refRangeLow: null,
        refRangeHigh: null,
        status: '',
      }))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/grid">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to grid</span>
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {biomarker.short_name ?? biomarker.name}
          </h1>
          {(systemName || panelName) && (
            <p className="text-sm text-muted-foreground">
              {systemName}
              {systemName && panelName ? ' > ' : ''}
              {panelName}
            </p>
          )}
        </div>
        <FavoriteButton biomarkerId={id} initialFavorited={favoriteIds.has(id)} />
      </div>

      {/* Reference Ranges + History with client-side unit conversion */}
      <UnitConversionWrapper
        biomarkerId={id}
        defaultUnit={biomarker.unit}
        availableUnits={biomarker.biomarker_units}
        initialPreference={unitPrefs.get(id) ?? null}
        ranges={biomarker.reference_ranges}
        sex={sex}
        points={points}
        markerName={biomarker.short_name ?? biomarker.name}
        resultCount={testResults.length}
        latestDate={latestDate}
        childBiomarkers={childBiomarkers.length > 0 ? childBiomarkers : undefined}
      />

      {/* About This Biomarker */}
      {description?.content && (
        <Card>
          <CardHeader>
            <CardTitle>About This Biomarker</CardTitle>
          </CardHeader>
          <CardContent>
            <InterpretationContent content={description.content} isStreaming={false} />
          </CardContent>
        </Card>
      )}

      {/* Contextual Insight */}
      <ContextualInsight
        biomarkerName={biomarker.short_name ?? biomarker.name}
        biomarkerId={id}
        unit={biomarker.unit}
        testResults={mappedTestResults}
        refRangeLow={refLow}
        refRangeHigh={refHigh}
        profile={profileContext}
        allMarkerContextForLatestTest={allMarkersForLatestTest}
      />

      {/* Related Markers */}
      {relatedMarkers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Related Markers</CardTitle>
          </CardHeader>
          <CardContent>
            <RelatedMarkers markers={relatedMarkers} currentId={id} />
          </CardContent>
        </Card>
      )}

      {/* Available Units */}
      {biomarker.biomarker_units.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-medium">Available Units</h2>
            <div className="mt-1 flex flex-wrap gap-1">
              {biomarker.biomarker_units.map((bu) => (
                <Badge key={bu.id} variant="outline" className="text-xs">
                  {bu.unit}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Available at these labs */}
      {labOfferingsResult.error && (
        <Card>
          <CardHeader>
            <CardTitle>Available at these labs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">
              Could not load labs right now. Refresh to try again.
            </p>
          </CardContent>
        </Card>
      )}
      {labOfferings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available at these labs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {labOfferings.map((o) => (
              <Link
                key={`${o.labId}-${o.testId}`}
                href={`/labs/${o.labId}`}
                className="block rounded-md border p-3 transition-colors hover:bg-accent"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {o.labName}
                    {o.city ? ` (${o.city})` : ''}
                  </span>
                  {o.cost != null && (
                    <span className="text-sm text-muted-foreground">
                      {o.cost} {o.currency ?? ''}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {o.testName}
                  {o.method ? ` · ${o.method}` : ''}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
