import type { ReferenceRange } from '@/lib/database.types'
import {
  findReferenceRange,
  formatRangeBounds,
  getRangeStatusFromRanges,
  getStatusColor,
  getStatusLabel,
} from '@/lib/grid/reference-range'
import { ReferenceRangeBar } from '@/components/biomarker/reference-range-bar'

interface ReferenceRangesProps {
  ranges: ReferenceRange[]
  unit: string
  sex: 'male' | 'female' | null
  latestValue: number | null
}

export function ReferenceRanges({
  ranges,
  unit,
  sex,
  latestValue,
}: ReferenceRangesProps) {
  const normalRange = findReferenceRange(ranges, unit, sex, undefined, 'normal')
  const optimalRange = findReferenceRange(
    ranges,
    unit,
    sex,
    undefined,
    'optimal'
  )

  // A one-sided range ('< 5') counts; only the bar needs both bounds.
  const hasNormal = normalRange.low != null || normalRange.high != null
  const hasOptimal = optimalRange.low != null || optimalRange.high != null

  if (!hasNormal && !hasOptimal) {
    return (
      <p className="text-sm text-muted-foreground">
        No reference ranges available
      </p>
    )
  }

  const status =
    latestValue != null
      ? getRangeStatusFromRanges(latestValue, ranges, unit, sex)
      : null

  return (
    <div className="space-y-4">
      {latestValue != null && hasNormal && status != null && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Your latest value</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(status)}`}
            >
              {getStatusLabel(status)}
            </span>
          </div>
          {normalRange.low != null && normalRange.high != null && (
            <ReferenceRangeBar
              value={latestValue}
              low={normalRange.low}
              high={normalRange.high}
              status={status}
            />
          )}
        </div>
      )}

      <div className="space-y-1">
        {hasNormal && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Normal Range</span>
            <span className="font-mono">
              {formatRangeBounds(normalRange.low, normalRange.high)} {unit}
            </span>
          </div>
        )}
        {hasOptimal && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Optimal Range</span>
            <span className="font-mono">
              {formatRangeBounds(optimalRange.low, optimalRange.high)} {unit}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
