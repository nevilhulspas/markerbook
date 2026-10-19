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
 * Apply unit conversions: display each row in the user's preferred unit, else
 * the most recent lab-reported unit, else the catalog unit.
 */
export function convertRowsToDisplayUnits(
  rows: GridRow[],
  unitPrefsMap: Map<string, string>,
  testDates: TestDate[]
): GridRow[] {
  return rows.map((row) => {
    if (!row.units || row.units.length <= 1) return row

    // Determine display unit: user preference > most recent lab unit > catalog unit
    const userPref = unitPrefsMap.get(row.biomarker.id)
    let displayUnit = userPref
    if (!displayUnit) {
      // Find most recent lab-reported unit from the last cell with data
      const testIds = testDates.map((t) => t.id)
      for (let i = testIds.length - 1; i >= 0; i--) {
        const cell = row.values[testIds[i]]
        if (cell) {
          displayUnit = cell.unit
          break
        }
      }
    }
    if (!displayUnit) displayUnit = row.biomarker.unit

    // Normalize displayUnit to canonical spelling from biomarker_units table
    if (displayUnit) {
      const norm = normalizeUnit(displayUnit)
      const canonicalUnit = row.units.find(
        (u) => normalizeUnit(u.unit) === norm
      )?.unit
      if (canonicalUnit) displayUnit = canonicalUnit
    }

    // Convert all cell values to display unit
    const convertedValues: typeof row.values = {}
    let anyChanged = false
    for (const [testId, cell] of Object.entries(row.values)) {
      if (!cell) {
        convertedValues[testId] = cell
        continue
      }
      if (normalizeUnit(cell.unit) === normalizeUnit(displayUnit)) {
        convertedValues[testId] = cell
        continue
      }
      const converted = convertValue(cell.value, cell.unit, displayUnit, row.units)
      // Not convertible (e.g. a legacy mmol/L reading against a g/dL↔g/L
      // catalog): keep the cell in its ORIGINAL unit+value. Relabelling it to
      // displayUnit would show a wrong number under the wrong header.
      if (converted === null) {
        convertedValues[testId] = cell
        continue
      }
      const rounded = Math.round(converted * 10) / 10
      anyChanged = true
      convertedValues[testId] = { ...cell, value: rounded, unit: displayUnit }
    }

    // Convert reference ranges to display unit. A range whose bound can't be
    // converted is dropped (null) rather than left as a raw number in the
    // wrong unit — an un-convertible bound can't be trusted for colouring.
    const bmUnits = row.units
    const convertedRanges = row.referenceRanges?.map((r) => {
      if (normalizeUnit(r.unit) === normalizeUnit(displayUnit)) return r
      const low = r.range_low != null
        ? convertValue(r.range_low, r.unit, displayUnit, bmUnits)
        : null
      const high = r.range_high != null
        ? convertValue(r.range_high, r.unit, displayUnit, bmUnits)
        : null
      return { ...r, range_low: low, range_high: high, unit: displayUnit }
    })

    // Only update biomarker unit display if it differs
    const unitChanged = normalizeUnit(row.biomarker.unit) !== normalizeUnit(displayUnit)

    return {
      ...row,
      values: anyChanged ? convertedValues : row.values,
      referenceRanges: convertedRanges,
      biomarker: unitChanged ? { ...row.biomarker, unit: displayUnit } : row.biomarker,
    }
  })
}
