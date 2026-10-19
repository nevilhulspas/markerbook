import { jsPDF } from 'jspdf'
import { lastAutoTableFinalY } from '@/lib/export/autotable'
import autoTable from 'jspdf-autotable'

import type { ExportList, ExportListItem } from '@/lib/labs/lab-test-tools'
import {
  formatListItems,
  COLUMN_LABELS,
  DEFAULT_FORMAT,
  type ListFormat,
  type ListColumn,
} from '@/lib/export/list-format'
import { pdfSafe } from '@/lib/export/pdf-text'
import { localDateISO } from '@/lib/dates/today'

const DISCLAIMER =
  'This list was generated from a personal health-tracking app for discussion ' +
  'with the laboratory. It is not a medical prescription or diagnosis.'

/** Compact "Method · Cost · Sample · Turnaround" line, limited to chosen columns. */
function metaLine(item: ExportListItem, columns: ListColumn[]): string {
  const parts: string[] = []
  if (columns.includes('method') && item.method) parts.push(item.method)
  if (columns.includes('cost') && item.cost != null) {
    parts.push(`${item.cost}${item.currency ? ' ' + item.currency : ''}`)
  }
  if (columns.includes('sample') && item.sample_type) parts.push(item.sample_type)
  if (columns.includes('turnaround') && item.turnaround_days != null) {
    parts.push(`${item.turnaround_days} day${item.turnaround_days === 1 ? '' : 's'}`)
  }
  return parts.join(' · ')
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'lab'
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * Total cost of the available (found, priced) items, grouped by currency, e.g.
 * "131.5 BGN + 47.14 EUR". Returns '' when nothing is priced.
 */
export function summarizeCostByCurrency(items: ExportListItem[]): string {
  const totals = new Map<string, number>()
  for (const it of items) {
    if (!it.found || it.cost == null) continue
    const cur = it.currency ?? ''
    totals.set(cur, (totals.get(cur) ?? 0) + it.cost)
  }
  if (totals.size === 0) return ''
  return [...totals.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cur, sum]) => `${round2(sum)}${cur ? ' ' + cur : ''}`)
    .join(' + ')
}

/** A single optional-column cell value for the PDF table. */
function pdfCell(item: ExportListItem, col: ListColumn): string {
  switch (col) {
    case 'method':
      return item.method ? pdfSafe(item.method) : '—'
    case 'cost':
      return item.cost != null ? `${item.cost}${item.currency ? ' ' + item.currency : ''}` : '—'
    case 'sample':
      return item.sample_type ? pdfSafe(item.sample_type) : '—'
    case 'turnaround':
      return item.turnaround_days != null ? `${item.turnaround_days}d` : '—'
    case 'reason':
      return item.reason ? pdfSafe(item.reason) : '—'
  }
}

/**
 * PURE: render a per-lab list as a plain-text document, honoring `format`
 * (columns / sort / hide-unavailable). `date` is injected for deterministic
 * (unit-testable) output.
 */
export function labListToText(
  list: ExportList,
  format: ListFormat = DEFAULT_FORMAT,
  date: string = localDateISO()
): string {
  const items = formatListItems(list.items, format)
  const lines: string[] = []
  lines.push(`Tests to request — ${list.labName}`)
  lines.push(`Generated: ${date}`)
  if (!list.labFound) {
    lines.push('(Note: this lab was not found in the directory; details unverified.)')
  }
  lines.push('')

  items.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.testName}`)
    const meta = metaLine(item, format.columns)
    if (meta) lines.push(`   ${meta}`)
    if (format.columns.includes('reason') && item.reason) lines.push(`   Why: ${item.reason}`)
  })

  if (format.columns.includes('cost')) {
    const total = summarizeCostByCurrency(items)
    lines.push('')
    if (total) lines.push(`Estimated total (available tests): ${total}`)
  } else {
    lines.push('')
  }
  lines.push('—')
  lines.push(DISCLAIMER)
  return lines.join('\n')
}

/** Trigger a client-side download of `content` as a file named `filename`. */
function downloadBlob(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Download the list as a .txt file (client-side). */
export function exportLabListAsTxt(list: ExportList, format: ListFormat = DEFAULT_FORMAT): void {
  const date = localDateISO()
  downloadBlob(labListToText(list, format, date), `${slug(list.labName)}-tests-${date}.txt`, 'text/plain;charset=utf-8')
}

/** Download the list as a formatted PDF (client-side), honoring `format`. */
export function exportLabListAsPdf(list: ExportList, format: ListFormat = DEFAULT_FORMAT): void {
  const items = formatListItems(list.items, format)
  const doc = new jsPDF()
  const date = localDateISO()

  doc.setFontSize(16)
  doc.setTextColor(33, 33, 33)
  doc.text(pdfSafe(`Tests to request — ${list.labName}`), 14, 20)

  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(`Generated: ${date}`, 14, 28)
  doc.text(`${items.length} test${items.length === 1 ? '' : 's'}`, 14, 34)

  const head = [['#', 'Test', ...format.columns.map((c) => COLUMN_LABELS[c])]]
  const body = items.map((item, i) => [
    String(i + 1),
    pdfSafe(item.testName),
    ...format.columns.map((c) => pdfCell(item, c)),
  ])

  // Append the total as the final BODY row (bold) — only when the Cost column is
  // shown. autoTable's `foot` repeats per page; we want it once at the bottom.
  const total = format.columns.includes('cost') ? summarizeCostByCurrency(items) : ''
  const totalRowIndex = total ? body.length : -1
  if (total) {
    body.push(['', 'Estimated total (available tests)', ...format.columns.map((c) => (c === 'cost' ? total : ''))])
  }

  autoTable(doc, {
    head,
    body,
    startY: 40,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 9 } },
    didParseCell(hook) {
      if (hook.section === 'body' && hook.row.index === totalRowIndex) {
        hook.cell.styles.fontStyle = 'bold'
        hook.cell.styles.fillColor = [238, 238, 238]
      }
    },
  })

  const finalY = lastAutoTableFinalY(doc)
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.setFont('helvetica', 'italic')
  doc.text(DISCLAIMER, 14, finalY + 10, { maxWidth: 180 })

  doc.save(`${slug(list.labName)}-tests-${date}.pdf`)
}
