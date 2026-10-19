import { jsPDF } from 'jspdf'
import { lastAutoTableFinalY } from '@/lib/export/autotable'
import autoTable, { type RowInput } from 'jspdf-autotable'

import { pdfSafe } from '@/lib/export/pdf-text'

// ---------------------------------------------------------------------------
// Format / shapes
// ---------------------------------------------------------------------------

import {
  DEFAULT_NTT_PDF_FORMAT,
  NTT_PDF_COLUMNS,
  NTT_PDF_COLUMN_LABELS,
  type NextToTestPdfColumn,
  type NextToTestPdfFormat,
  type NttPdfGroup,
  type NttPdfRow,
} from '@/lib/export/next-to-test-pdf-format'
import { localDateISO } from '@/lib/dates/today'

export {
  DEFAULT_NTT_PDF_FORMAT,
  NTT_PDF_COLUMNS,
  NTT_PDF_COLUMN_LABELS,
  type NextToTestPdfColumn,
  type NextToTestPdfFormat,
  type NttPdfGroup,
  type NttPdfRow,
} from '@/lib/export/next-to-test-pdf-format'

/** A built table row: a category section header, or a numbered entry row. */
export type NttTableRow =
  | { kind: 'section'; label: string }
  | { kind: 'row'; cells: string[] }

const DISCLAIMER =
  'This list was generated from a personal health-tracking app for your own ' +
  'reference. It is not a medical prescription or diagnosis.'

function orderedColumns(format: NextToTestPdfFormat): NextToTestPdfColumn[] {
  return NTT_PDF_COLUMNS.filter((c) => format.columns.includes(c))
}

function cellValue(row: NttPdfRow, col: NextToTestPdfColumn): string {
  switch (col) {
    case 'source':
      return row.source_label.trim() || '—'
    case 'note':
      return row.note?.trim() || '—'
    case 'due':
      return row.due_date?.trim() || '—'
    case 'status':
      return row.status
  }
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'list'
}

/**
 * PURE: build the head + body for the next-to-test PDF. The `#` and `Name`
 * columns are always present; optional columns follow in canonical order.
 * Each non-empty group contributes a `section` row (its label) followed by one
 * `row` per entry, numbered from 1 within the group. Empty groups are dropped.
 */
export function buildNextToTestTable(
  groups: NttPdfGroup[],
  format: NextToTestPdfFormat
): { head: string[]; body: NttTableRow[] } {
  const cols = orderedColumns(format)
  const head = ['#', 'Name', ...cols.map((c) => NTT_PDF_COLUMN_LABELS[c])]
  const body: NttTableRow[] = []
  for (const group of groups) {
    if (group.rows.length === 0) continue
    body.push({ kind: 'section', label: group.label })
    group.rows.forEach((row, i) => {
      body.push({
        kind: 'row',
        cells: [String(i + 1), row.name, ...cols.map((c) => cellValue(row, c))],
      })
    })
  }
  return { head, body }
}

/**
 * Download the current next-to-test view as a formatted PDF (client-side),
 * grouped by category. Thin wrapper around {@link buildNextToTestTable} + jsPDF.
 */
export function exportNextToTestAsPdf(
  groups: NttPdfGroup[],
  listName: string,
  format: NextToTestPdfFormat = DEFAULT_NTT_PDF_FORMAT
): void {
  const { head, body } = buildNextToTestTable(groups, format)
  const totalCols = head.length
  const date = localDateISO()
  const count = groups.reduce((n, g) => n + g.rows.length, 0)

  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.setTextColor(33, 33, 33)
  doc.text(pdfSafe(`Next to test — ${listName}`), 14, 20)

  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(`Generated: ${date}`, 14, 28)
  doc.text(`${count} test${count === 1 ? '' : 's'}`, 14, 34)

  // Section rows span every column with a bold, shaded style; entry rows are
  // plain strings, run through pdfSafe so unicode punctuation doesn't break
  // jsPDF's Latin-1 font.
  const tableBody: RowInput[] = body.map((r) =>
    r.kind === 'section'
      ? [
          {
            content: pdfSafe(r.label),
            colSpan: totalCols,
            styles: {
              fontStyle: 'bold' as const,
              fillColor: [238, 238, 238] as [number, number, number],
            },
          },
        ]
      : r.cells.map((c) => pdfSafe(c))
  )

  autoTable(doc, {
    head: [head],
    body: tableBody,
    startY: 40,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 9 } },
  })

  const finalY = lastAutoTableFinalY(doc)
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.setFont('helvetica', 'italic')
  doc.text(DISCLAIMER, 14, finalY + 10, { maxWidth: 180 })

  doc.save(`next-to-test-${slug(listName)}-${date}.pdf`)
}
