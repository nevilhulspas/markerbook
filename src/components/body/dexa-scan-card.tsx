import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { gramsToKg } from '@/lib/body/metrics'
import { APP_LOCALE } from '@/lib/locale'
import type { DexaScan } from '@/lib/database.types'

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString(APP_LOCALE, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function DexaScanCard({ scan }: { scan: DexaScan }) {
  const lean = scan.lean_mass_g == null ? null : gramsToKg(scan.lean_mass_g)
  return (
    <Link
      href={`/body/${scan.id}`}
      className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/30 hover:bg-muted/30"
    >
      <div className="space-y-1">
        <div className="font-medium">{fmtDate(scan.scan_date)}</div>
        <div className="text-sm text-muted-foreground">{scan.provider ?? 'DEXA scan'}</div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm tabular-nums">
          <span>{scan.body_fat_pct == null ? '—' : `${scan.body_fat_pct.toFixed(1)}%`} fat</span>
          <span>{lean == null ? '—' : `${lean.toFixed(1)} kg`} lean</span>
          <span>{scan.total_mass_kg == null ? '—' : `${scan.total_mass_kg.toFixed(1)} kg`} total</span>
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  )
}
