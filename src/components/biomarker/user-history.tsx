'use client'

import Link from 'next/link'
import { TrendChart } from '@/components/analytics/trend-chart'
import type { TrendData } from '@/lib/analytics/marker-trends'
import { APP_LOCALE } from '@/lib/locale'

interface UserHistoryProps {
  trendData: TrendData | null
  resultCount: number
  latestValue: number | null
  latestDate: string | null
  unit: string
  childBiomarkers?: Array<{
    id: string
    name: string
    short_name: string | null
  }>
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return new Intl.DateTimeFormat(APP_LOCALE, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function UserHistory({
  trendData,
  resultCount,
  latestValue,
  latestDate,
  unit,
  childBiomarkers,
}: UserHistoryProps) {
  // 0 results
  if (resultCount === 0) {
    return (
      <div className="space-y-4">
        <div className="flex h-[120px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          No results yet
        </div>
        {childBiomarkers && childBiomarkers.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              This biomarker has variants with data:
            </p>
            <div className="flex flex-wrap gap-2">
              {childBiomarkers.map((child) => (
                <Link
                  key={child.id}
                  href={`/biomarkers/${child.id}`}
                  className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {child.short_name ?? child.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // 1 result
  if (resultCount === 1 && latestValue != null) {
    const formatted = Number.isInteger(latestValue)
      ? latestValue
      : latestValue.toFixed(2)

    return (
      <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 p-6">
        <span className="text-3xl font-bold tabular-nums">{formatted}</span>
        <span className="text-sm text-muted-foreground">{unit}</span>
        {latestDate && (
          <span className="mt-1 text-xs text-muted-foreground">
            {formatDate(latestDate)}
          </span>
        )}
      </div>
    )
  }

  // 2+ results
  if (trendData) {
    return <TrendChart data={trendData} />
  }

  return null
}
