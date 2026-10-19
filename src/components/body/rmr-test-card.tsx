import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import type { RmrTest } from '@/lib/database.types'
import { APP_LOCALE } from '@/lib/locale'

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString(APP_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function RmrTestCard({ test }: { test: RmrTest }) {
  return (
    <Link
      href={`/body/rmr/${test.id}`}
      className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/30 hover:bg-muted/30"
    >
      <div className="space-y-1">
        <div className="font-medium">{fmtDate(test.test_date)}</div>
        <div className="text-sm text-muted-foreground">{test.provider ?? 'RMR test'}</div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm tabular-nums">
          <span>{Math.round(test.rmr_kcal)} kcal/day RMR</span>
          {test.predicted_rmr_kcal != null && (
            <span>{Math.round(test.predicted_rmr_kcal)} predicted</span>
          )}
          {test.fuel_carb_pct != null && (
            <span>
              {Math.round(test.fuel_carb_pct)}% carbs / {test.fuel_fat_pct == null ? '—' : `${Math.round(test.fuel_fat_pct)}%`} fat
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  )
}
