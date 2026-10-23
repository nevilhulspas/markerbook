import { getStatusColor, type RangeStatus } from '@/lib/grid/reference-range'
import { cn } from '@/lib/utils'

const LEGEND_ITEMS: { status: RangeStatus; label: string }[] = [
  { status: 'normal', label: 'In range' },
  { status: 'borderline', label: 'Just outside range' },
  { status: 'out-of-range', label: 'Out of range' },
  { status: 'unknown', label: 'No reference range' },
]

/** Explains the cell colours and the ↑/↓ arrows shown in the marker grid. */
export function GridLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground', className)}
      aria-label="Grid legend"
      role="group"
    >
      {LEGEND_ITEMS.map(({ status, label }) => (
        <span key={status} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn('size-3 rounded-sm', getStatusColor(status))} />
          {label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <span aria-hidden="true" className="font-medium text-foreground">
          ↑ ↓
        </span>
        Above / below range
      </span>
    </div>
  )
}
