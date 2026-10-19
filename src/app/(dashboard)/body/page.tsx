import type { Metadata } from 'next'
import Link from 'next/link'
import { Flame, Plus, Scale } from 'lucide-react'

import { getScans, getGoals, getProfileSex } from '@/actions/dexa'
import { getRmrTests } from '@/actions/rmr'
import { getLogEntries } from '@/actions/body-log'
import { scanMetricViews } from '@/lib/body/display'
import { APP_LOCALE } from '@/lib/locale'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MetricBandCard } from '@/components/body/metric-band-card'
import { BodyTrendChart } from '@/components/body/body-trend-chart'
import { GoalsEditor } from '@/components/body/goals-editor'
import { DexaScanCard } from '@/components/body/dexa-scan-card'
import { RmrCard } from '@/components/body/rmr-card'
import { RmrTestCard } from '@/components/body/rmr-test-card'
import { RmrTrendChart } from '@/components/body/rmr-trend-chart'
import { BodyLogForm } from '@/components/body/body-log-form'
import { BodyLogList } from '@/components/body/body-log-list'

export const metadata: Metadata = { title: 'Body Comp | Markerbook' }

export default async function BodyCompPage() {
  const [scans, goals, sex, logEntries, rmrTests] = await Promise.all([
    getScans(),
    getGoals(),
    getProfileSex(),
    getLogEntries(),
    getRmrTests(),
  ])
  const latest = scans[0]
  const latestRmr = rmrTests[0]
  const goalByMetric = new Map(goals.map((g) => [g.metric, g.target_value]))
  const hasData = scans.length > 0 || logEntries.length > 0

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Body Comp</h1>
          <p className="text-muted-foreground">
            Track DEXA scans and day-to-day measurements over time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild>
            <Link href="/body/import">
              <Scale className="size-4" />
              Import DEXA scan
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/body/rmr/import">
              <Flame className="size-4" />
              Import RMR test
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/body/rmr/new">
              <Plus className="size-4" />
              New RMR test
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick-add measurement — always available, even before any DEXA scan. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Log a measurement</CardTitle>
        </CardHeader>
        <CardContent>
          <BodyLogForm />
        </CardContent>
      </Card>

      {latest && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Latest scan · {new Date(latest.scan_date).toLocaleDateString(APP_LOCALE)}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {scanMetricViews(latest).map((view) => {
              const target = goalByMetric.get(view.bandMetric as never)
              return (
                <MetricBandCard
                  key={view.bandMetric}
                  view={view}
                  sex={sex}
                  age={latest.age_years}
                  targetValue={target ?? null}
                />
              )
            })}
          </CardContent>
        </Card>
      )}

      {hasData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <BodyTrendChart scans={scans} logEntries={logEntries} />
          </CardContent>
        </Card>
      )}

      {logEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Measurements</CardTitle>
          </CardHeader>
          <CardContent>
            <BodyLogList entries={logEntries} />
          </CardContent>
        </Card>
      )}

      {scans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">DEXA scans</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {scans.map((scan) => (
              <DexaScanCard key={scan.id} scan={scan} />
            ))}
          </CardContent>
        </Card>
      )}

      {latestRmr && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Latest RMR · {new Date(latestRmr.test_date).toLocaleDateString(APP_LOCALE)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RmrCard test={latestRmr} />
          </CardContent>
        </Card>
      )}

      {rmrTests.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">RMR trend</CardTitle>
          </CardHeader>
          <CardContent>
            <RmrTrendChart tests={rmrTests} />
          </CardContent>
        </Card>
      )}

      {rmrTests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">RMR tests</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {rmrTests.map((test) => (
              <RmrTestCard key={test.id} test={test} />
            ))}
          </CardContent>
        </Card>
      )}

      <GoalsEditor goals={goals} />

      <p className="text-xs text-muted-foreground">
        Reference bands are general population estimates, not medical advice.
      </p>
    </PageContainer>
  )
}
