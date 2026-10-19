import { jsPDF } from 'jspdf'

import type { SupplementWithIntakes } from '@/lib/database.types'
import { winAnsiSafe } from '@/lib/export/pdf-text'
import { groupByIntakeTime, type IntakeGroup } from '@/lib/supplements/intake'

// Sized for a schedule you pin up and scan, not a document you read: small
// type and tight rows so a full stack stays on one sheet. 8pt body is the
// floor for comfortable print — the secondary columns go to 7pt rather than
// shrinking the supplement names, which are what you actually look for.
// All lengths are PDF points on A4; `y` is always a text baseline.
const MARGIN = 28
const TITLE_SIZE = 13
const META_SIZE = 7
const GROUP_TIME_SIZE = 10
const GROUP_COUNT_SIZE = 7
const NAME_SIZE = 8
const DETAIL_SIZE = 7
const DETAIL_WIDTH = 72

const META_GAP = 10 // title baseline → meta baseline
const GROUP_GAP = 20 // previous baseline → group header baseline
const AFTER_META_GAP = 8 // extra space between the meta line and the first group
const RULE_OFFSET = 4.5 // header baseline → its underline
const FIRST_ROW_GAP = 16 // header baseline → first row baseline
const ROW_GAP = 12.5 // row baseline → next row baseline
const WRAP_GAP = 9.5 // extra baseline per wrapped line inside a row

const GREY = '#666666'
const DARK_GREY = '#444444'
const BLACK = '#000000'

type Row = IntakeGroup['rows'][number]

/**
 * The printable Stack. Reuses `groupByIntakeTime` so the paper copy can never
 * disagree with the screen.
 */
export async function renderStackPdf(
  mode: 'active' | 'upcoming',
  supplements: SupplementWithIntakes[],
  generatedOn: string
): Promise<Buffer> {
  const groups = groupByIntakeTime(supplements)
  const title = mode === 'active' ? 'Stack — Active' : 'Stack — Upcoming'

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  doc.setProperties({ title })
  doc.setFont('helvetica', 'normal')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageBottom = doc.internal.pageSize.getHeight() - MARGIN
  const amountX = pageWidth - MARGIN - DETAIL_WIDTH
  const doseX = amountX - DETAIL_WIDTH
  const nameWidth = doseX - MARGIN

  const text = (value: string | string[], x: number, y: number, size: number, color: string) => {
    doc.setFontSize(size)
    doc.setTextColor(color)
    doc.text(value, x, y, { lineHeightFactor: WRAP_GAP / size })
  }

  // Wrapped lines per column; a row is as tall as its tallest column. User text
  // goes through winAnsiSafe: the built-in font cannot draw e.g. "β" or "₂".
  const layoutRow = (row: Row) => {
    doc.setFontSize(NAME_SIZE)
    const name: string[] = doc.splitTextToSize(winAnsiSafe(row.supplement.name), nameWidth - 4)
    doc.setFontSize(DETAIL_SIZE)
    const dose: string[] = doc.splitTextToSize(winAnsiSafe(row.supplement.dose ?? '—'), DETAIL_WIDTH - 4)
    const amount: string[] = doc.splitTextToSize(winAnsiSafe(row.amount ?? '—'), DETAIL_WIDTH - 4)
    const lines = Math.max(name.length, dose.length, amount.length)
    return { name, dose, amount, extra: (lines - 1) * WRAP_GAP }
  }

  let y = MARGIN + TITLE_SIZE * 0.8
  text(title, MARGIN, y, TITLE_SIZE, BLACK)
  y += META_GAP
  text(`Generated ${generatedOn}`, MARGIN, y, META_SIZE, GREY)

  if (groups.length === 0) {
    text('No supplements.', MARGIN, y + 18, NAME_SIZE, GREY)
  }

  const newPage = () => {
    doc.addPage()
    y = MARGIN
  }

  const drawHeader = (label: string, count: string) => {
    text(label, MARGIN, y, GROUP_TIME_SIZE, BLACK)
    doc.setFontSize(GROUP_COUNT_SIZE)
    doc.setTextColor(GREY)
    doc.text(count, pageWidth - MARGIN, y, { align: 'right' })
    doc.setDrawColor(BLACK)
    doc.setLineWidth(0.5)
    doc.line(MARGIN, y + RULE_OFFSET, pageWidth - MARGIN, y + RULE_OFFSET)
  }

  let gap = GROUP_GAP + AFTER_META_GAP
  for (const group of groups) {
    const rows = group.rows.map(layoutRow)
    // From the header baseline to the last row's baseline.
    const height =
      FIRST_ROW_GAP +
      (rows.length - 1) * ROW_GAP +
      rows.reduce((sum, r) => sum + r.extra, 0)

    // A group that fits on a page never splits: it moves to the next page. A
    // group taller than a page starts where it is (if its header and first row
    // fit) and continues under a repeated "(continued)" header.
    const onFreshPage = y <= MARGIN
    const fitsOnAPage = GROUP_TIME_SIZE * 0.8 + height <= pageBottom - MARGIN
    const needed = fitsOnAPage ? height : FIRST_ROW_GAP + rows[0].extra
    if (!onFreshPage && y + gap + needed > pageBottom) {
      newPage()
      gap = GROUP_TIME_SIZE * 0.8
    }

    y += gap
    gap = GROUP_GAP
    const label = group.time ?? 'No time set'
    const count = `${group.rows.length} ${group.rows.length === 1 ? 'item' : 'items'}`
    drawHeader(label, count)

    y += FIRST_ROW_GAP
    rows.forEach((row, i) => {
      if (i > 0) y += ROW_GAP
      if (y + row.extra > pageBottom) {
        newPage()
        y += GROUP_TIME_SIZE * 0.8
        drawHeader(`${label} (continued)`, count)
        y += FIRST_ROW_GAP
      }
      text(row.name, MARGIN, y, NAME_SIZE, BLACK)
      text(row.dose, doseX, y, DETAIL_SIZE, DARK_GREY)
      text(row.amount, amountX, y, DETAIL_SIZE, DARK_GREY)
      y += row.extra
    })
  }

  return Buffer.from(doc.output('arraybuffer'))
}
