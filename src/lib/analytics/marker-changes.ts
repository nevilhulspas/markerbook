import type { Sex } from '@/lib/database.types'
import type { GridRow } from '@/lib/grid/grid-types'
import { convertValue, normalizeUnit } from '@/lib/grid/unit-conversion'
import {
  getRangeStatusFromRanges,
  getRangeStatus,
  type RangeStatus,
} from '@/lib/grid/reference-range'

export interface MarkerChange {
  biomarkerId: string
  markerName: string
  previousValue: number
  currentValue: number
  unit: string
  delta: number
  percentChange: number
  direction: 'up' | 'down'
  status: RangeStatus
  previousStatus: RangeStatus
}

/**
 * Compute marker changes between two consecutive tests.
 * Returns changes sorted by absolute percent change descending.
 * Filters out markers that are unchanged (delta === 0) or only present in one test.
 */
export function computeMarkerChanges(
  rows: GridRow[],
  currentTestId: string,
  previousTestId: string,
  userSex?: Sex | null
): MarkerChange[] {
  const changes: MarkerChange[] = []
  const rangeSex =
    userSex === 'male' || userSex === 'female' ? userSex : null

  for (const row of rows) {
    const current = row.values[currentTestId]
    const rawPrevious = row.values[previousTestId]
    if (!current || !rawPrevious) continue

    // Compare like with like: bring the previous value into the current
    // value's unit; skip the marker when that is not possible (30 ng/mL
    // then 75 nmol/L vitamin D is no change, not +150%).
    let previous = rawPrevious
    if (normalizeUnit(rawPrevious.unit) !== normalizeUnit(current.unit)) {
      const converted = convertValue(rawPrevious.value, rawPrevious.unit, current.unit, row.units ?? [], {
        unit: row.catalogueUnit ?? row.biomarker.unit,
        loinc_code: row.biomarker.loinc_code,
        name: row.biomarker.name,
        molar_mass: row.biomarker.molar_mass,
        valence: row.biomarker.valence,
      })
      if (converted === null) continue
      previous = { ...rawPrevious, value: converted, unit: current.unit }
    }

    const delta = current.value - previous.value
    if (delta === 0) continue

    const percentChange =
      previous.value !== 0 ? (delta / previous.value) * 100 : 0

    const hasEnrichedRanges =
      row.referenceRanges && row.referenceRanges.length > 0

    // Match the range by the CELL's own unit — a value stored in mmol/L must
    // be judged against a mmol/L range, never against the catalog unit's
    // range (5.5 mmol/L glucose is NOT out of range vs 70-99 mg/dL). The
    // inline biomarker fields only apply when their unit matches the cell's.
    const status = hasEnrichedRanges
      ? getRangeStatusFromRanges(
          current.value,
          row.referenceRanges!,
          current.unit,
          rangeSex
        )
      : normalizeUnit(current.unit) === normalizeUnit(row.biomarker.unit)
        ? getRangeStatus(current.value, row.biomarker, userSex)
        : 'unknown'

    const previousStatus = hasEnrichedRanges
      ? getRangeStatusFromRanges(
          previous.value,
          row.referenceRanges!,
          previous.unit,
          rangeSex
        )
      : normalizeUnit(previous.unit) === normalizeUnit(row.biomarker.unit)
        ? getRangeStatus(previous.value, row.biomarker, userSex)
        : 'unknown'

    changes.push({
      biomarkerId: row.biomarker.id,
      markerName: row.biomarker.short_name ?? row.biomarker.name,
      previousValue: previous.value,
      currentValue: current.value,
      unit: current.unit,
      delta,
      percentChange,
      direction: delta > 0 ? 'up' : 'down',
      status,
      previousStatus,
    })
  }

  return changes.sort(
    (a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange)
  )
}
