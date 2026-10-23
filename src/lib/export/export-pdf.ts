import { jsPDF } from 'jspdf'
import { lastAutoTableFinalY } from '@/lib/export/autotable'
import autoTable from 'jspdf-autotable'
import type { GridData } from '@/lib/grid/grid-types'
import type { Sex } from '@/lib/database.types'
import {
  findReferenceRange,
  getRangeStatusFromRanges,
  type RangeStatus,
} from '@/lib/grid/reference-range'
import { APP_LOCALE } from '@/lib/locale'
import { normalizeUnit } from '@/lib/grid/unit-conversion'
import { formatUnitValue } from '@/lib/units/convert'
import { localDateISO } from '@/lib/dates/today'

const STATUS_COLORS: Record<RangeStatus, [number, number, number] | null> = {
  normal: [220, 252, 231], // green-100
  borderline: [254, 249, 195], // yellow-100
  'out-of-range': [254, 226, 226], // red-100
  unknown: null,
}

/**
 * Export GridData as a formatted PDF report.
 * Creates a landscape PDF with a color-coded table showing marker values
 * with reference range status indication.
 */
export function exportGridAsPdf(data: GridData, userSex?: Sex | null): void {
  const { rows, testDates } = data
  const doc = new jsPDF({ orientation: 'landscape' })

  // Narrow Sex to male | female | null for range lookups
  const rangeSex = userSex === 'male' || userSex === 'female' ? userSex : null

  // Title
  doc.setFontSize(16)
  doc.setTextColor(33, 33, 33)
  doc.text('Markerbook Report', 14, 20)

  // Metadata
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  const generatedDate = new Date().toLocaleDateString(APP_LOCALE, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  doc.text(`Generated: ${generatedDate}`, 14, 28)
  doc.text(`${rows.length} markers across ${testDates.length} test(s)`, 14, 34)

  // Table headers
  const headers = ['Marker', 'Unit', 'Ref. Range', ...testDates.map((td) => td.date)]

  // Table body
  const body: string[][] = []
  const cellStatusMap: Record<string, RangeStatus> = {}

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx]
    const displayName = row.biomarker.short_name ?? row.biomarker.name

    // The grid passes rows already in their display unit: the unit column
    // is that unit, and a cell that could not be converted keeps (and prints)
    // its own unit.
    const rowUnit = row.biomarker.unit

    // Determine reference range string
    let refRangeStr = '-'
    if (row.referenceRanges && row.referenceRanges.length > 0) {
      const range = findReferenceRange(row.referenceRanges, rowUnit, rangeSex)
      if (range.low != null && range.high != null) {
        refRangeStr = `${formatUnitValue(range.low)}-${formatUnitValue(range.high)}`
      }
    }

    const cells: string[] = [displayName, rowUnit, refRangeStr]

    for (let colIdx = 0; colIdx < testDates.length; colIdx++) {
      const td = testDates[colIdx]
      const cellData = row.values[td.id]
      if (cellData != null) {
        // Self-label values whose unit differs from the row's (mirrors the
        // grid's inline-unit behaviour — never print a number under a unit
        // header it isn't).
        const label =
          normalizeUnit(cellData.unit) === normalizeUnit(rowUnit)
            ? formatUnitValue(cellData.value)
            : `${formatUnitValue(cellData.value)} ${cellData.unit}`
        cells.push(label)

        // Compute status for color coding — always against a range in the
        // CELL's own unit.
        if (row.referenceRanges && row.referenceRanges.length > 0) {
          const status = getRangeStatusFromRanges(
            cellData.value,
            row.referenceRanges,
            cellData.unit,
            rangeSex
          )
          cellStatusMap[`${rowIdx}-${colIdx + 3}`] = status
        }
      } else {
        cells.push('-')
      }
    }

    body.push(cells)
  }

  // Render table
  autoTable(doc, {
    head: [headers],
    body,
    startY: 40,
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [51, 51, 51],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    didParseCell(hookData) {
      if (hookData.section === 'body') {
        const key = `${hookData.row.index}-${hookData.column.index}`
        const status = cellStatusMap[key]
        if (status) {
          const color = STATUS_COLORS[status]
          if (color) {
            hookData.cell.styles.fillColor = color
          }
        }
      }
    },
  })

  // Disclaimer footer
  const finalY = lastAutoTableFinalY(doc)
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.setFont('helvetica', 'italic')
  doc.text(
    'Disclaimer: This report is for informational purposes only and does not constitute medical advice. ' +
      'Always consult a qualified healthcare professional for interpretation of your blood test results.',
    14,
    finalY + 12,
    { maxWidth: 270 }
  )

  // Save
  const date = localDateISO()
  doc.save(`markerbook-report-${date}.pdf`)
}
