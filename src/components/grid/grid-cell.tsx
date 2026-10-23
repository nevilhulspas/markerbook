'use client'

import type { Biomarker, ReferenceRange, Sex } from '@/lib/database.types'
import {
  findReferenceRange,
  getRangeStatus,
  getRangeStatusFromRanges,
  getStatusColor,
  type RangeStatus,
} from '@/lib/grid/reference-range'
import { formatConverted, normalizeUnit } from '@/lib/grid/unit-conversion'
import { formatQualified } from '@/lib/blood-tests/qualifier'
import { cn } from '@/lib/utils'

interface GridCellProps {
  value: number
  /** '<' / '>' etc. for a result such as "<0.5". */
  qualifier?: string | null
  /** This cell's actual unit — may differ from the column's displayUnit when
   *  the reading couldn't be converted (e.g. a legacy mmol/L value). */
  unit: string
  /** The unit the marker's column is showing, for the differ-check. */
  displayUnit: string
  biomarker: Biomarker
  userSex?: Sex | null
  referenceRanges?: ReferenceRange[]
  onClick: (status: RangeStatus) => void
}

type RangeDirection = 'above' | 'below'

/**
 * Which side of the normal range a value falls on, using the same range the
 * status was computed from. Null when the value is inside it or no range applies.
 */
function getRangeDirection(
  value: number,
  unit: string,
  biomarker: Biomarker,
  userSex: Sex | null | undefined,
  referenceRanges: ReferenceRange[] | undefined
): RangeDirection | null {
  const rangeSex = userSex === 'male' || userSex === 'female' ? userSex : null
  const { low, high } =
    referenceRanges && referenceRanges.length > 0
      ? findReferenceRange(referenceRanges, unit, rangeSex)
      : rangeSex === 'male' && biomarker.ref_range_low_male != null
        ? { low: biomarker.ref_range_low_male, high: biomarker.ref_range_high_male }
        : rangeSex === 'female' && biomarker.ref_range_low_female != null
          ? { low: biomarker.ref_range_low_female, high: biomarker.ref_range_high_female }
          : { low: biomarker.ref_range_low, high: biomarker.ref_range_high }
  if (low != null && value < low) return 'below'
  if (high != null && value > high) return 'above'
  return null
}

export function GridCell({
  value,
  qualifier,
  unit,
  displayUnit,
  biomarker,
  userSex,
  referenceRanges,
  onClick,
}: GridCellProps) {
  // Narrow 'other' to null for range lookup (only male/female have sex-specific ranges)
  const rangeSex = userSex === 'male' || userSex === 'female' ? userSex : null
  // Colour by the cell's OWN unit, not the column's — an un-converted reading
  // (kept in its original unit) must be matched against a same-unit range or
  // fall back to 'unknown', never coloured against the display unit's range.
  const status = referenceRanges && referenceRanges.length > 0
    ? getRangeStatusFromRanges(value, referenceRanges, unit, rangeSex)
    : normalizeUnit(unit) === normalizeUnit(biomarker.unit)
      ? getRangeStatus(value, biomarker, userSex)
      : 'unknown'
  const colorClass = getStatusColor(status)
  // Colour alone is not enough (colour-blind users, screen readers): flag the
  // side of the range with an arrow and spoken text.
  const direction =
    status === 'borderline' || status === 'out-of-range'
      ? getRangeDirection(value, unit, biomarker, userSex, referenceRanges)
      : null
  const formatted = formatQualified(formatConverted(value), qualifier)
  // Show the unit inline only when it doesn't match the column, so the reader
  // sees this value wasn't converted to the chosen display unit.
  const showUnit = normalizeUnit(unit) !== normalizeUnit(displayUnit)

  return (
    <button
      type="button"
      className={cn(
        'w-full cursor-pointer rounded-sm px-2 py-1 text-center text-sm font-medium transition-opacity hover:opacity-80',
        colorClass
      )}
      onClick={() => onClick(status)}
      title={showUnit ? `${formatted} ${unit}: cannot be converted to ${displayUnit}` : undefined}
    >
      {formatted}
      {direction && (
        <>
          <span aria-hidden="true" className="ml-0.5">
            {direction === 'above' ? '↑' : '↓'}
          </span>
          <span className="sr-only">{direction === 'above' ? ' above range' : ' below range'}</span>
        </>
      )}
      {showUnit && (
        <span className="ml-0.5 text-[10px] font-normal opacity-70">{unit}</span>
      )}
    </button>
  )
}
