import type { GridRow, GridData } from '@/lib/grid/grid-types'
import { findReferenceRange } from '@/lib/grid/reference-range'
import { convertValue, normalizeUnit } from '@/lib/grid/unit-conversion'

export interface TrendDataPoint {
  date: string // YYYY-MM-DD
  value: number
  testName: string
  unit?: string // unit of `value` (target unit when converted, original when not)
  bloodTestId?: string
}

export interface TrendData {
  points: TrendDataPoint[]
  refLow: number | null
  refHigh: number | null
  unit: string
  markerName: string
  /** Results left out because they could not be converted to `unit`. */
  skipped: number
}

/**
 * Build trend chart data from a single grid row across all test dates.
 * Points only include tests where the marker was actually measured.
 * testDates are expected to be sorted ascending by date.
 */
export function buildTrendData(
  row: GridRow,
  testDates: GridData['testDates'],
  sex?: 'male' | 'female' | null
): TrendData {
  // The chart plots every point on one axis labelled with the marker's unit
  // (row.biomarker.unit). Convert points stored in another unit to that axis
  // whenever the catalog has factors; an un-convertible point keeps its
  // original value+unit (never relabel a number into a unit it isn't).
  const unit = row.biomarker.unit
  const unitFactors = row.units ?? []
  const ctx = {
    unit: row.catalogueUnit ?? row.biomarker.unit,
    loinc_code: row.biomarker.loinc_code,
    name: row.biomarker.name,
    molar_mass: row.biomarker.molar_mass,
    valence: row.biomarker.valence,
  }
  const points: TrendDataPoint[] = []
  let skipped = 0

  for (const td of testDates) {
    const cell = row.values[td.id]
    if (!cell) continue
    let value = cell.value
    let pointUnit = cell.unit
    if (normalizeUnit(cell.unit) !== normalizeUnit(unit)) {
      const converted = convertValue(cell.value, cell.unit, unit, unitFactors, ctx)
      // Can't place this point on the marker-unit axis — drop it rather than
      // plot a number in a unit the axis doesn't label (mirrors the grid's
      // keep-original-cell behaviour: the chart has no inline-unit escape).
      if (converted === null) {
        skipped++
        continue
      }
      value = converted
      pointUnit = unit
    }
    points.push({ date: td.date, value, testName: td.name, unit: pointUnit })
  }

  const ranges = row.referenceRanges ?? []
  const { low: refLow, high: refHigh } = findReferenceRange(
    ranges,
    unit,
    sex
  )

  return {
    points,
    refLow,
    refHigh,
    unit,
    markerName: row.biomarker.short_name ?? row.biomarker.name,
    skipped,
  }
}
