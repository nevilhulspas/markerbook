import type { ReferenceRange } from '@/lib/database.types'
import type { ParsedMayoRange, RangeDiffItem } from './types'

/**
 * Compare proposed Mayo Clinic ranges against existing reference ranges.
 * Only matches against normal ranges (Mayo provides normal ranges, not optimal).
 */
export function computeRangeDiff(
  currentRanges: ReferenceRange[],
  proposedRanges: ParsedMayoRange[]
): RangeDiffItem[] {
  const items: RangeDiffItem[] = []

  // Only match against normal ranges (Mayo provides normal ranges, not optimal)
  const normalRanges = currentRanges.filter((r) => r.range_type === 'normal')

  for (const proposed of proposedRanges) {
    // Try to find a matching current range by unit + sex
    const match = normalRanges.find(
      (r) => r.unit.toLowerCase() === proposed.unit.toLowerCase() && r.sex === proposed.sex
    )

    items.push({
      rangeId: match?.id ?? null,
      field: match ? 'range_low' : 'new',
      currentValue: match?.range_low ?? null,
      proposedValue: proposed.range_low,
      current: match
        ? {
            range_low: match.range_low,
            range_high: match.range_high,
            unit: match.unit,
            sex: match.sex,
            source: match.source,
            range_type: match.range_type,
          }
        : null,
      proposed,
    })
  }

  return items
}
