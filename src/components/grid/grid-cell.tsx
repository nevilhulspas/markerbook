'use client'

import type { Biomarker, ReferenceRange, Sex } from '@/lib/database.types'
import {
  getRangeStatus,
  getRangeStatusFromRanges,
  getStatusColor,
  type RangeStatus,
} from '@/lib/grid/reference-range'
import { formatConverted, normalizeUnit } from '@/lib/grid/unit-conversion'
import { cn } from '@/lib/utils'

interface GridCellProps {
  value: number
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

export function GridCell({
  value,
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
  const formatted = formatConverted(value)
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
      {showUnit && (
        <span className="ml-0.5 text-[10px] font-normal opacity-70">{unit}</span>
      )}
    </button>
  )
}
