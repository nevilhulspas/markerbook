'use client'

import type { MicrobiomeStatus } from '@/lib/database.types'
import { barGeometry } from '@/lib/microbiome/format'
import { cn } from '@/lib/utils'

interface MicrobiomeBarProps {
  value: number | null
  refLow: number | null
  refHigh: number | null
  unit: string | null
  status: MicrobiomeStatus | null
}

const MARKER_COLOR: Record<MicrobiomeStatus, string> = {
  low: 'bg-amber-500',
  high: 'bg-red-500',
  normal: 'bg-emerald-600',
  unknown: 'bg-muted-foreground',
}

/**
 * A compact log/linear position bar: a neutral track with the reference
 * (green) zone shaded and a marker showing where the value falls. Makes
 * "how far below normal" obvious at a glance — e.g. a CFU value 250× under
 * its floor sits hard-left instead of looking like just another number.
 */
export function MicrobiomeBar({
  value,
  refLow,
  refHigh,
  unit,
  status,
}: MicrobiomeBarProps) {
  const geo = barGeometry(value, refLow, refHigh, unit)
  if (!geo) return null

  const refStart = geo.refStart ?? 0
  const refEnd = geo.refEnd ?? 1
  const markerColor = MARKER_COLOR[(status ?? 'unknown') as MicrobiomeStatus]

  return (
    <div
      className="relative h-2 w-full min-w-24 overflow-hidden rounded-full bg-muted"
      title={geo.log ? 'log scale' : undefined}
    >
      {/* reference (in-range) zone */}
      <div
        className="absolute inset-y-0 bg-emerald-500/25"
        style={{
          left: `${refStart * 100}%`,
          width: `${Math.max(0, refEnd - refStart) * 100}%`,
        }}
      />
      {/* value marker */}
      <div
        className={cn(
          'absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background',
          markerColor
        )}
        style={{ left: `${geo.valuePos * 100}%` }}
      />
    </div>
  )
}
