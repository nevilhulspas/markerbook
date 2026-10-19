import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import type { OtherTest } from '@/lib/database.types'
import { APP_LOCALE } from '@/lib/locale'
import { OtherOutcomeBadge } from './other-outcome-badge'

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString(APP_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function OtherTestCard({ test }: { test: OtherTest }) {
  return (
    <Link
      href={`/other/${test.id}`}
      className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/30 hover:bg-muted/30"
    >
      <div className="min-w-0 space-y-1">
        <div className="truncate font-medium">{test.test_name}</div>
        <div className="text-sm text-muted-foreground">
          {fmtDate(test.test_date)}
          {test.provider ? ` · ${test.provider}` : ''}
        </div>
        {test.result_summary && (
          <div className="truncate text-sm text-muted-foreground">{test.result_summary}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <OtherOutcomeBadge outcome={test.outcome} />
        <ChevronRight className="size-5 text-muted-foreground" />
      </div>
    </Link>
  )
}
