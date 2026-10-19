import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'

import { getScan, getScans, getGoals, getProfileSex } from '@/actions/dexa'
import { scanMetricViews } from '@/lib/body/display'
import { trendDelta } from '@/lib/body/metrics'
import { APP_LOCALE } from '@/lib/locale'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MetricBandCard } from '@/components/body/metric-band-card'
import { RegionalTable } from '@/components/body/regional-table'
import { DeleteScanButton } from '@/components/body/delete-scan-button'
import { notFoundOrAuthOutage } from '@/lib/supabase/session'

function fmtDelta(abs: number | null): string | null {
  if (abs == null) return null
  const sign = abs > 0 ? '+' : ''
  return `${sign}${abs.toFixed(1)} vs prev`
}

export default async function DexaScanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [detail, allScans, goals, sex] = await Promise.all([
    getScan(id),
    getScans(),
    getGoals(),
    getProfileSex(),
  ])
  if (!detail) return notFoundOrAuthOutage()

  const { scan, regions } = detail
  const goalByMetric = new Map(goals.map((g) => [g.metric, g.target_value]))

  // Previous scan = the most recent one strictly before this scan's date.
  const previous = allScans
    .filter((s) => s.id !== scan.id && s.scan_date < scan.scan_date)
    .sort((a, b) => b.scan_date.localeCompare(a.scan_date))[0]
  const prevByMetric = previous
    ? new Map(scanMetricViews(previous).map((v) => [v.bandMetric, v.value]))
    : null

  return (
    <PageContainer width="wide" className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/body">
              <ArrowLeft className="size-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {new Date(scan.scan_date).toLocaleDateString(APP_LOCALE, {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </h1>
            <p className="text-muted-foreground">{scan.provider ?? 'DEXA scan'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/body/${scan.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          <DeleteScanButton scanId={scan.id} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {scanMetricViews(scan).map((view) => {
          const target = goalByMetric.get(view.bandMetric as never)
          const prev = prevByMetric?.get(view.bandMetric) ?? null
          const delta = view.value == null ? null : fmtDelta(trendDelta(view.value, prev).abs)
          return (
            <MetricBandCard
              key={view.bandMetric}
              view={view}
              sex={sex}
              age={scan.age_years}
              targetValue={target ?? null}
              delta={delta}
            />
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regional breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {regions.length > 0 ? (
            <RegionalTable regions={regions} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No regional breakdown was captured for this scan.
            </p>
          )}
        </CardContent>
      </Card>

      {scan.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{scan.notes}</CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Reference bands are general population estimates, not medical advice.
      </p>
    </PageContainer>
  )
}
