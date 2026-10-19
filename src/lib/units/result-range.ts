import type { Biomarker, ReferenceRange } from '@/lib/database.types'
import {
  findReferenceRange,
  getRangeStatus,
  getRangeStatusFromRanges,
  type RangeStatus,
} from '@/lib/grid/reference-range'
import { convertUnit, type MarkerUnits } from './convert'
import { sameUnit } from './parse'

export interface ResultRange {
  status: RangeStatus
  low: number | null
  high: number | null
  /** The unit of `low` / `high`, or null when no range applies. */
  unit: string | null
}

/**
 * The normal range and status for one stored result (value + the unit it was
 * entered in). A range in another unit still applies when the value converts
 * to that unit; the comparison is then done in the range's unit. The result
 * is 'unknown' when no range can be compared without guessing.
 */
export function resolveResultRange(
  value: number,
  unit: string,
  biomarker: Biomarker,
  ranges: ReferenceRange[],
  marker: MarkerUnits,
  sex?: 'male' | 'female' | null,
  age?: number | null
): ResultRange {
  if (ranges.length > 0) {
    const units: string[] = []
    for (const r of ranges) {
      if ((r.range_type ?? 'normal') !== 'normal') continue
      if (!units.some((u) => sameUnit(u, r.unit))) units.push(r.unit)
    }
    // The result's own unit first, so no conversion is used when not needed.
    units.sort((a, b) => Number(sameUnit(b, unit)) - Number(sameUnit(a, unit)))
    for (const u of units) {
      const v = convertUnit(value, unit, u, marker)
      if (v === null) continue
      const { low, high } = findReferenceRange(ranges, u, sex, age)
      if (low == null && high == null) continue
      return { status: getRangeStatusFromRanges(v, ranges, u, sex, age), low, high, unit: u }
    }
    return { status: 'unknown', low: null, high: null, unit: null }
  }

  // Inline biomarker range columns are in the catalogue unit.
  const v = convertUnit(value, unit, biomarker.unit, marker)
  if (v === null) return { status: 'unknown', low: null, high: null, unit: null }
  return {
    status: getRangeStatus(v, biomarker, sex),
    low: biomarker.ref_range_low,
    high: biomarker.ref_range_high,
    unit: biomarker.unit,
  }
}

/** The unit facts for one biomarker, from its row and its `biomarker_units`. */
export function markerUnitsFor(
  biomarker: Pick<Biomarker, 'unit' | 'loinc_code' | 'name'>,
  units: ReadonlyArray<{ unit: string; conversion_factor: number }> = []
): MarkerUnits {
  return {
    catalogueUnit: biomarker.unit,
    factors: units.map((u) => ({ unit: u.unit, conversion_factor: Number(u.conversion_factor) })),
    loincCode: biomarker.loinc_code,
    name: biomarker.name,
  }
}

export interface DescribedResult {
  /** The value in the display unit, or in its own unit when not convertible. */
  shown: { value: number; unit: string; inDisplayUnit: boolean }
  /** The value and unit as entered (stored). */
  entered: { value: number; unit: string }
  range: ResultRange
  /** The range bounds in `shown.unit` when possible, else in `range.unit`. */
  rangeShown: { low: number | null; high: number | null; unit: string | null }
  /** The value in `range.unit`, for a context that pairs value and range. */
  valueInRangeUnit: number | null
}

/**
 * One stored result for display: shown in `displayUnit` (the preference, else
 * the catalogue unit), with the entered value kept next to it, and its range
 * and status compared in a unit that both share.
 */
export function describeResult(
  value: number,
  unit: string,
  biomarker: Biomarker,
  ranges: ReferenceRange[],
  marker: MarkerUnits,
  displayUnit: string,
  sex?: 'male' | 'female' | null,
  age?: number | null
): DescribedResult {
  const converted = convertUnit(value, unit, displayUnit, marker)
  const shown =
    converted === null
      ? { value, unit, inDisplayUnit: false }
      : { value: converted, unit: displayUnit, inDisplayUnit: true }
  const range = resolveResultRange(value, unit, biomarker, ranges, marker, sex, age)

  let rangeShown: DescribedResult['rangeShown'] = { low: range.low, high: range.high, unit: range.unit }
  if (range.unit) {
    const to = (b: number | null) => (b == null ? null : convertUnit(b, range.unit as string, shown.unit, marker))
    const low = to(range.low)
    const high = to(range.high)
    if ((range.low == null || low !== null) && (range.high == null || high !== null)) {
      rangeShown = { low, high, unit: shown.unit }
    }
  }
  return {
    shown,
    entered: { value, unit },
    range,
    rangeShown,
    valueInRangeUnit: range.unit ? convertUnit(value, unit, range.unit, marker) : null,
  }
}

/**
 * The unit facts for a grid row. A row whose `biomarker.unit` was switched to
 * a display unit keeps the catalogue unit in `catalogueUnit`; the factors are
 * relative to that one.
 */
export function markerUnitsForRow(row: {
  biomarker: Pick<Biomarker, 'unit' | 'loinc_code' | 'name'>
  units?: ReadonlyArray<{ unit: string; conversion_factor: number }>
  catalogueUnit?: string
}): MarkerUnits {
  return markerUnitsFor(
    { ...row.biomarker, unit: row.catalogueUnit ?? row.biomarker.unit },
    row.units ?? []
  )
}
