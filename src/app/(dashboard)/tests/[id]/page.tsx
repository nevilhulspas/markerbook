import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'

import { getBloodTest } from '@/actions/blood-tests'
import { createClient } from '@/lib/supabase/server'
import type { BiomarkerUnit, Profile, ReferenceRange } from '@/lib/database.types'
import { toClientProfile } from '@/lib/profile/client-profile'
import type { RangeStatus } from '@/lib/grid/reference-range'
import { describeResult, markerUnitsFor } from '@/lib/units/result-range'
import { formatUnitValue } from '@/lib/units/convert'
import { getUnitPreferences } from '@/actions/unit-preferences'
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
  const [{ data: refRanges }, { data: unitRows }, unitPrefs] = await Promise.all([
    biomarkerIds.length > 0
      ? supabase.from('reference_ranges').select('*').in('biomarker_id', biomarkerIds)
      : Promise.resolve({ data: null }),
    biomarkerIds.length > 0
      ? supabase.from('biomarker_units').select('*').in('biomarker_id', biomarkerIds)
      : Promise.resolve({ data: null }),
    getUnitPreferences(),
  ])

  // biomarker_id -> its known units with conversion factors
  const unitsByBiomarker = new Map<string, BiomarkerUnit[]>()
  for (const u of (unitRows ?? []) as BiomarkerUnit[]) {
    const list = unitsByBiomarker.get(u.biomarker_id) ?? []
    list.push(u)
    unitsByBiomarker.set(u.biomarker_id, list)
  }

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
            unitsByBiomarker={unitsByBiomarker}
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
                const sexValue =
                  profile?.sex === 'male' || profile?.sex === 'female' ? profile.sex : null
                const d = describeResult(
                  result.value,
                  result.unit,
                  bm,
                  rangesByBiomarker.get(bm.id) ?? [],
                  markerUnitsFor(bm, unitsByBiomarker.get(bm.id)),
                  unitPrefs.get(bm.id) ?? bm.unit,
                  sexValue
                )
                const status: RangeStatus = d.range.status
                const { low, high, unit: rangeUnit } = d.rangeShown
                const rangeStr =
                  low != null && high != null
                    ? `${formatUnitValue(low)} - ${formatUnitValue(high)}${
                        rangeUnit && rangeUnit !== d.shown.unit ? ` ${rangeUnit}` : ''
                      }`
                    : '--'
                const convertedFromOther = d.shown.unit !== d.entered.unit

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
                    <TableCell className="font-mono">
                      {formatUnitValue(d.shown.value)}
                      {convertedFromOther && (
                        <span className="block text-xs font-sans text-muted-foreground">
                          entered as {formatUnitValue(d.entered.value)} {d.entered.unit}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{d.shown.unit}</TableCell>
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
