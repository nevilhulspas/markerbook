// Pure transforms behind the marker grid: which date columns show, which rows
// survive the filters, and which unit each row is displayed in. Extracted from
// marker-grid.tsx unchanged so they can be unit-tested.

import type { Annotation, Sex } from '@/lib/database.types'
import type { GridData, GridRow } from '@/lib/grid/grid-types'
import { getRangeStatus, getRangeStatusFromRanges, type RangeStatus } from '@/lib/grid/reference-range'
import { convertValue, normalizeUnit } from '@/lib/grid/unit-conversion'

type TestDate = GridData['testDates'][number]

/** Keep test-date columns inside the optional [dateFrom, dateTo] range (ISO dates, inclusive). */
export function filterTestDatesByRange(
  testDates: TestDate[],
  dateFrom: string | undefined,
  dateTo: string | undefined
): TestDate[] {
  if (!dateFrom && !dateTo) return testDates
  return testDates.filter((td) => {
    if (dateFrom && td.date < dateFrom) return false
    if (dateTo && td.date > dateTo) return false
    return true
  })
}

/** Merge annotation-only dates as extra columns, sorted chronologically. */
export function mergeAnnotationDateColumns(
  filteredTestDates: TestDate[],
  annotations: Annotation[]
): { mergedDateColumns: TestDate[]; annotationOnlyIds: Set<string> } {
  const testDateSet = new Set(filteredTestDates.map((td) => td.date))
  const extraDates = new Map<string, string>() // date -> synthetic id
  for (const a of annotations) {
    if (!testDateSet.has(a.date) && !extraDates.has(a.date)) {
      extraDates.set(a.date, `ann-${a.date}`)
    }
    if (a.end_date && !testDateSet.has(a.end_date) && !extraDates.has(a.end_date)) {
      extraDates.set(a.end_date, `ann-${a.end_date}`)
    }
  }

  if (extraDates.size === 0) {
    return { mergedDateColumns: filteredTestDates, annotationOnlyIds: new Set<string>() }
  }

  const extras = Array.from(extraDates.entries()).map(([date, id]) => ({
    id,
    date,
    name: '', // no test name for annotation-only columns
  }))

  const merged = [...filteredTestDates, ...extras].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  return {
    mergedDateColumns: merged,
    annotationOnlyIds: new Set(extras.map((e) => e.id)),
  }
}

/** Filter rows by category and status before passing them to the table. */
export function filterRowsByCategoryAndStatus(
  rows: GridRow[],
  {
    categories,
    status,
    testDates,
    userSex,
  }: {
    categories?: string[]
    status?: RangeStatus[]
    testDates: TestDate[]
    userSex?: Sex | null
  }
): GridRow[] {
  let result = rows

  // Category filter
  if (categories && categories.length > 0) {
    const catSet = new Set(categories)
    result = result.filter((r) => catSet.has(r.category))
  }

  // Status filter: keep rows that have at least one cell matching the selected statuses
  if (status && status.length > 0) {
    const statusSet = new Set<RangeStatus>(status)
    const rangeSex = userSex === 'male' || userSex === 'female' ? userSex : null
    result = result.filter((r) => {
      // Check each test date for a matching status
      for (const td of testDates) {
        const cellData = r.values[td.id]
        if (cellData) {
          // Judge by the cell's OWN unit so the filter agrees with the
          // status colours shown in the (possibly unit-converted) grid.
          const cellStatus = r.referenceRanges && r.referenceRanges.length > 0
            ? getRangeStatusFromRanges(cellData.value, r.referenceRanges, cellData.unit, rangeSex)
            : normalizeUnit(cellData.unit) === normalizeUnit(r.biomarker.unit)
              ? getRangeStatus(cellData.value, r.biomarker, userSex)
              : 'unknown'
          if (statusSet.has(cellStatus)) return true
        }
      }
      return false
    })
  }

  return result
}

/**
 * The unit a marker is shown in: the user's choice for that marker, else the
 * catalogue unit. Never the unit of the latest lab report, so a new import in
 * another unit does not silently switch what the user sees.
 */
export function displayUnitFor(row: GridRow, unitPrefsMap: Map<string, string>): string {
  const pref = unitPrefsMap.get(row.biomarker.id)
  const display = pref || row.biomarker.unit
  // Show the catalogue's spelling of that unit when it has one.
  const known = row.units?.find((u) => normalizeUnit(u.unit) === normalizeUnit(display))?.unit
  return known ?? display
}

/**
 * Show every cell and reference range in the row's display unit
 * ({@link displayUnitFor}). Each cell converts from the unit it was entered
 * in. A cell that cannot be converted keeps its own value and unit (the grid
 * marks it), and a range bound that cannot be converted becomes null. Values
 * keep full precision; formatting happens when they are rendered.
 */
export function convertRowsToDisplayUnits(
  rows: GridRow[],
  unitPrefsMap: Map<string, string>,
  // Kept for callers; the display unit no longer depends on the test dates.
  _testDates?: TestDate[]
): GridRow[] {
  return rows.map((row) => {
    const displayUnit = displayUnitFor(row, unitPrefsMap)
    const units = row.units ?? []
    const ctx = { unit: row.biomarker.unit, loinc_code: row.biomarker.loinc_code, name: row.biomarker.name }

    const convertedValues: typeof row.values = {}
    let anyChanged = false
    for (const [testId, cell] of Object.entries(row.values)) {
      if (!cell || cell.unit === displayUnit) {
        convertedValues[testId] = cell
        continue
      }
      if (normalizeUnit(cell.unit) === normalizeUnit(displayUnit)) {
        // Same unit, other spelling ("ug/l" = "ng/mL"): relabel, same value.
        anyChanged = true
        convertedValues[testId] = { ...cell, unit: displayUnit }
        continue
      }
      const converted = convertValue(cell.value, cell.unit, displayUnit, units, ctx)
      if (converted === null) {
        convertedValues[testId] = cell
        continue
      }
      anyChanged = true
      convertedValues[testId] = { ...cell, value: converted, unit: displayUnit }
    }

    let rangesChanged = false
    const convertedRanges = row.referenceRanges?.map((r) => {
      if (normalizeUnit(r.unit) === normalizeUnit(displayUnit)) return r
      rangesChanged = true
      const low = r.range_low != null ? convertValue(r.range_low, r.unit, displayUnit, units, ctx) : null
      const high = r.range_high != null ? convertValue(r.range_high, r.unit, displayUnit, units, ctx) : null
      return { ...r, range_low: low, range_high: high, unit: displayUnit }
    })

    const unitChanged = row.biomarker.unit !== displayUnit
    if (!anyChanged && !rangesChanged && !unitChanged) return row

    // The biomarker's inline ranges are in its catalogue unit; move them to
    // the display unit too, so a status never compares across units.
    const inline = (v: number | null) =>
      v == null ? null : convertValue(v, row.biomarker.unit, displayUnit, units, ctx)
    const displayBiomarker = unitChanged
      ? {
          ...row.biomarker,
          unit: displayUnit,
          ref_range_low: inline(row.biomarker.ref_range_low),
          ref_range_high: inline(row.biomarker.ref_range_high),
          ref_range_low_male: inline(row.biomarker.ref_range_low_male),
          ref_range_high_male: inline(row.biomarker.ref_range_high_male),
          ref_range_low_female: inline(row.biomarker.ref_range_low_female),
          ref_range_high_female: inline(row.biomarker.ref_range_high_female),
        }
      : row.biomarker

    return {
      ...row,
      values: anyChanged ? convertedValues : row.values,
      referenceRanges: rangesChanged ? convertedRanges : row.referenceRanges,
      // The original catalogue facts stay available for conversions and the
      // inline ranges; `unit` here is what the row is displayed in.
      catalogueUnit: row.catalogueUnit ?? row.biomarker.unit,
      biomarker: displayBiomarker,
    }
  })
}
