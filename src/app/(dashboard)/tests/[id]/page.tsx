import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'

import { getBloodTest } from '@/actions/blood-tests'
import { createClient } from '@/lib/supabase/server'
import type { Profile, ReferenceRange } from '@/lib/database.types'
import { toClientProfile } from '@/lib/profile/client-profile'
import {
  findReferenceRange,
  getRangeStatus,
  getRangeStatusFromRanges,
  type RangeStatus,
} from '@/lib/grid/reference-range'
import { normalizeUnit } from '@/lib/grid/unit-conversion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DeleteTestButton } from '@/components/tests/delete-test-button'
import { TestDetailClient } from '@/components/tests/test-detail-client'
import { APP_LOCALE } from '@/lib/locale'
import { notFoundOrAuthOutage } from '@/lib/supabase/session'
import { getRequestUser } from '@/lib/supabase/request-user'

export const metadata: Metadata = {
  title: 'View Blood Test | Markerbook',
}

function formatDate(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString(APP_LOCALE, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function sampleTypeLabel(type: string): string {
  switch (type) {
    case 'serum':
      return 'Serum'
    case 'plasma':
      return 'Plasma'
    default:
      return 'Unknown'
  }
}

function statusBadge(status: RangeStatus) {
  switch (status) {
    case 'normal':
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          Normal
        </Badge>
      )
    case 'borderline':
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
          Borderline
        </Badge>
      )
    case 'out-of-range':
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
          Out of range
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary">No range</Badge>
      )
  }
}

export default async function TestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { data: test, error } = await getBloodTest(id)

  if (error || !test) {
    return notFoundOrAuthOutage(error)
  }

  // Fetch user profile for sex-specific ranges and AI personalization
  const supabase = await createClient()
  const {
    data: { user },
  } = await getRequestUser()

  const { data: profile } = user
    ? await supabase.from('profiles').select('*').eq('id', user.id).single()
    : { data: null }

  // Fetch reference ranges for biomarkers in this test
  const biomarkerIds = test.test_results.map((r) => r.biomarkers.id)
  const { data: refRanges } = biomarkerIds.length > 0
    ? await supabase
        .from('reference_ranges')
        .select('*')
        .in('biomarker_id', biomarkerIds)
    : { data: null }

  // Build lookup: biomarker_id -> ReferenceRange[]
  const rangesByBiomarker = new Map<string, ReferenceRange[]>()
  for (const range of (refRanges ?? []) as ReferenceRange[]) {
    const list = rangesByBiomarker.get(range.biomarker_id) ?? []
    list.push(range)
    rangesByBiomarker.set(range.biomarker_id, list)
  }

  const sortedResults = [...test.test_results].sort((a, b) =>
    a.biomarkers.category.localeCompare(b.biomarkers.category) ||
    a.biomarkers.name.localeCompare(b.biomarkers.name)
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/tests">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to tests</span>
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{test.name}</h1>
          <p className="text-muted-foreground">{formatDate(test.test_date)}</p>
        </div>
        <div className="flex items-center gap-2">
          <TestDetailClient
            test={test}
            profile={toClientProfile((profile as Profile) ?? null)}
            rangesByBiomarker={rangesByBiomarker}
          />
          <Button variant="outline" size="sm" asChild>
            <Link href={`/tests/${test.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          <DeleteTestButton testId={test.id} testName={test.name} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-medium text-muted-foreground">Sample Type</dt>
              <dd>{sampleTypeLabel(test.sample_type)}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Markers</dt>
              <dd>{test.test_results.length} result{test.test_results.length === 1 ? '' : 's'}</dd>
            </div>
            {test.notes && (
              <div className="sm:col-span-3">
                <dt className="font-medium text-muted-foreground">Notes</dt>
                <dd className="whitespace-pre-wrap">{test.notes}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Marker Results</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Biomarker</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Reference Range</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedResults.map((result) => {
                const bm = result.biomarkers
                const bmRanges = rangesByBiomarker.get(bm.id) ?? []
                const sexValue = profile?.sex as 'male' | 'female' | null

                // Use new reference_ranges table if available, fallback to inline
                let rangeStr: string
                let status: RangeStatus

                if (bmRanges.length > 0) {
                  const { low, high } = findReferenceRange(
                    bmRanges,
                    result.unit,
                    sexValue
                  )
                  rangeStr =
                    low != null && high != null ? `${low} - ${high}` : '--'
                  status = getRangeStatusFromRanges(
                    result.value,
                    bmRanges,
                    result.unit,
                    sexValue
                  )
                } else if (
                  normalizeUnit(result.unit) === normalizeUnit(bm.unit)
                ) {
                  // Fallback to inline range columns (only when their unit
                  // matches the result's stored unit).
                  rangeStr =
                    bm.ref_range_low != null && bm.ref_range_high != null
                      ? `${bm.ref_range_low} - ${bm.ref_range_high}`
                      : '--'
                  status = getRangeStatus(
                    result.value,
                    bm,
                    profile?.sex as 'male' | 'female' | 'other' | undefined
                  )
                } else {
                  rangeStr = '--'
                  status = 'unknown'
                }

                return (
                  <TableRow key={result.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{bm.name}</span>
                        <span className="ml-1 text-xs text-muted-foreground">
                          {bm.category}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{result.value}</TableCell>
                    <TableCell>{result.unit}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {rangeStr}
                    </TableCell>
                    <TableCell>{statusBadge(status)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
