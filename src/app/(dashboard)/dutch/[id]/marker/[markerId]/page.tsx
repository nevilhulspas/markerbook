import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getDutchTestDetail } from '@/actions/dutch-tests'
import { createClient } from '@/lib/supabase/server'
import type { ReferenceRange } from '@/lib/database.types'
import {
  findReferenceRange,
  getRangeStatusFromRanges,
  getStatusColor,
  getStatusLabel,
} from '@/lib/grid/reference-range'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ReferenceRangeBar } from '@/components/biomarker/reference-range-bar'
import { AiDescription } from '@/components/biomarker/ai-description'
import { throwIfAuthOutage } from '@/lib/supabase/auth-outage'
import { notFoundOrAuthOutage } from '@/lib/supabase/session'
import { getRequestUser } from '@/lib/supabase/request-user'

export const metadata: Metadata = {
  title: 'DUTCH Marker Detail | Bloodmarkers',
}

const CATEGORY_LABELS: Record<string, string> = {
  dutch_estrogen: 'Estrogen',
  dutch_androgen: 'Androgens',
  dutch_progesterone: 'Progesterone',
  dutch_adrenal: 'Cortisol & Adrenal',
  dutch_oat: 'Organic Acids',
  dutch_other: 'Other',
}

export default async function DutchMarkerDetailPage({
  params,
}: {
  params: Promise<{ id: string; markerId: string }>
}) {
  const { id, markerId } = await params

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
  const [testResult, profileResult, refRangesResult, descriptionResult] =
    await Promise.all([
      getDutchTestDetail(id),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase
        .from('dutch_reference_ranges')
        .select('*')
        .eq('biomarker_id', markerId),
      supabase
        .from('dutch_marker_descriptions')
        .select('*')
        .eq('biomarker_id', markerId)
        .maybeSingle(),
    ])

  if (testResult.error || !testResult.data) {
    return notFoundOrAuthOutage(testResult.error)
  }

  const test = testResult.data
  const profile = profileResult.data
  const refRanges = (refRangesResult.data ?? []) as ReferenceRange[]
  const description = descriptionResult.data

  // Find all results matching this biomarker
  const matchingResults = test.dutch_test_results.filter(
    (r) => r.biomarker_id === markerId
  )

  if (matchingResults.length === 0) {
    return notFoundOrAuthOutage()
  }

  // Primary result: the one with timepoint === null (24h aggregate), or first if all have timepoints
  const primaryResult =
    matchingResults.find((r) => r.timepoint === null) ?? matchingResults[0]
  const biomarker = primaryResult.biomarkers

  // Timepoint-specific results (those with a timepoint value)
  const timepointResults = matchingResults.filter(
    (r) => r.timepoint !== null
  )

  // Compute sex and phase for reference range lookup
  const sex =
    profile?.sex === 'male' || profile?.sex === 'female' ? profile.sex : null
  const phase =
    test.menstrual_phase === 'male' ? null : test.menstrual_phase

  // Compute reference range and status for primary result
  const { low, high } = findReferenceRange(
    refRanges,
    primaryResult.unit,
    sex,
    null,
    'normal',
    phase
  )
  const status = getRangeStatusFromRanges(
    primaryResult.value,
    refRanges,
    primaryResult.unit,
    sex,
    null,
    phase
  )

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dutch/${id}`}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to DUTCH test</span>
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {biomarker.short_name ?? biomarker.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {CATEGORY_LABELS[biomarker.category] ?? biomarker.category}
          </p>
        </div>
        <Badge className={getStatusColor(status)}>
          {getStatusLabel(status)}
        </Badge>
      </div>

      {/* Value and Reference Range */}
      <Card>
        <CardHeader>
          <CardTitle>Result</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums">
              {primaryResult.value}
            </span>
            <span className="text-lg text-muted-foreground">
              {primaryResult.unit}
            </span>
          </div>
          {low !== null && high !== null && (
            <>
              <ReferenceRangeBar
                value={primaryResult.value}
                low={low}
                high={high}
                status={status}
              />
              <p className="text-xs text-muted-foreground">
                Reference range: {low} - {high} {primaryResult.unit}
              </p>
            </>
          )}
          {low === null && high === null && (
            <p className="text-sm text-muted-foreground">
              No reference range available for this marker
            </p>
          )}
        </CardContent>
      </Card>

      {/* Timepoint Values (diurnal markers only) */}
      {timepointResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Diurnal Values</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {timepointResults.map((r) => {
                const tpStatus = getRangeStatusFromRanges(
                  r.value,
                  refRanges,
                  r.unit,
                  sex,
                  null,
                  phase
                )
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm font-medium">
                      {r.timepoint}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums">
                        {r.value} {r.unit}
                      </span>
                      <Badge className={getStatusColor(tpStatus)}>
                        {getStatusLabel(tpStatus)}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Description */}
      <AiDescription
        biomarkerId={markerId}
        descriptionTarget="dutch_marker"
        cachedContent={description?.content ?? null}
        isStale={false}
        cachedAt={description?.updated_at ?? null}
      />
    </div>
  )
}
