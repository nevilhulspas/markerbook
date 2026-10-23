import type { GridData } from '@/lib/grid/grid-types'
import { localDateISO } from '@/lib/dates/today'
import { normalizeUnit } from '@/lib/grid/unit-conversion'

/**
 * Escape a value for CSV output.
 * Wraps in double quotes and doubles internal quotes when value contains
 * commas, quotes, or newlines.
 */
export function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Build CSV content string from GridData.
 * Returns a UTF-8 BOM prefixed string with headers and data rows.
 */
export function buildCsvContent(data: GridData): string {
  const { rows, testDates } = data

  // Header row: Category, Marker, Unit, then test dates
  const headers = ['Category', 'Marker', 'Unit', ...testDates.map((td) => td.date)]
  const lines: string[] = []
  lines.push(headers.map(escapeCsv).join(','))

  // Data rows
  for (const row of rows) {
    const cells: string[] = [
      escapeCsv(row.category),
      escapeCsv(row.biomarker.name),
      escapeCsv(row.biomarker.unit),
    ]

    for (const td of testDates) {
      const cellData = row.values[td.id]
      if (cellData == null) {
        cells.push('')
      } else if (normalizeUnit(cellData.unit) === normalizeUnit(row.biomarker.unit)) {
        cells.push(String(cellData.value))
      } else {
        // Not convertible to the row's unit: keep the value with its own
        // unit, so it is never read as a value in the column's unit.
        cells.push(escapeCsv(`${cellData.value} ${cellData.unit}`))
      }
    }

    lines.push(cells.join(','))
  }

  // Prefix with UTF-8 BOM
  return '\uFEFF' + lines.join('\n')
}

/**
 * Download a Blob as a file.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/**
 * Export GridData as a CSV file download.
 * Filename: markerbook-YYYY-MM-DD.csv
 */
export function exportGridAsCsv(data: GridData): void {
  const csvContent = buildCsvContent(data)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const date = localDateISO()
  downloadBlob(blob, `markerbook-${date}.csv`)
}
