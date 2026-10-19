import { type RangeStatus } from '@/lib/grid/reference-range'
import { cn } from '@/lib/utils'

export function ReferenceRangeBar({
  value,
  low,
  high,
  status,
}: {
  value: number
  low: number
  high: number
  status: RangeStatus
}) {
  // Calculate the visual range with some padding beyond the reference range
  const range = high - low
  const padding = range * 0.3
  const visualMin = low - padding
  const visualMax = high + padding
  const visualRange = visualMax - visualMin

  // Calculate positions as percentages
  const lowPos = ((low - visualMin) / visualRange) * 100
  const highPos = ((high - visualMin) / visualRange) * 100
  const valuePos = Math.max(
    2,
    Math.min(98, ((value - visualMin) / visualRange) * 100)
  )

  const markerColorClass =
    status === 'normal'
      ? 'bg-green-500'
      : status === 'borderline'
        ? 'bg-yellow-500'
        : 'bg-red-500'

  return (
    <div className="space-y-1">
      <div className="relative h-6 w-full rounded-full bg-muted">
        {/* Normal range zone */}
        <div
          className="absolute top-0 h-full rounded-full bg-green-200 dark:bg-green-900/40"
          style={{ left: `${lowPos}%`, width: `${highPos - lowPos}%` }}
        />
        {/* Value marker */}
        <div
          className={cn(
            'absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm dark:border-gray-800',
            markerColorClass
          )}
          style={{ left: `${valuePos}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  )
}
