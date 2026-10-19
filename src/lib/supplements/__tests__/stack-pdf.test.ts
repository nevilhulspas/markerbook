import { describe, it, expect } from 'vitest'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

import { renderStackPdf } from '@/lib/supplements/stack-pdf'
import type { SupplementWithIntakes } from '@/lib/database.types'

/** Every text line the PDF draws, page by page, read back with pdf.js. */
async function pdfLines(buffer: Buffer): Promise<string[][]> {
  const doc = await getDocument({ data: new Uint8Array(buffer) }).promise
  const pages: string[][] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent()
    // Group the text runs into lines by baseline (y). Columns in smaller type
    // sit a few points off the main baseline, so runs within 4pt share a line.
    // pdf.js may split a phrase into words; a gap wider than a space is a new
    // column, written as " | ".
    const rows: { y: number; runs: { x: number; width: number; str: string }[] }[] = []
    for (const item of content.items) {
      if (!('str' in item) || item.str.trim() === '') continue
      const y = item.transform[5]
      let row = rows.find((r) => Math.abs(r.y - y) < 4)
      if (!row) rows.push((row = { y, runs: [] }))
      row.runs.push({ x: item.transform[4], width: item.width, str: item.str.trim() })
    }
    pages.push(
      rows
        .sort((a, b) => b.y - a.y)
        .map(({ runs: row }) => {
          row.sort((a, b) => a.x - b.x)
          let line = row[0].str
          for (let i = 1; i < row.length; i++) {
            const gap = row[i].x - (row[i - 1].x + row[i - 1].width)
            line += (gap > 6 ? ' | ' : ' ') + row[i].str
          }
          // NFKC: pdf.js reads the micro sign (µ, U+00B5) back as Greek mu.
          return line.normalize('NFKC')
        })
    )
  }
  return pages
}

function supp(
  name: string,
  intakes: { time: string; amount: string | null }[],
  dose: string | null = '400 mg'
): SupplementWithIntakes {
  return {
    id: name,
    user_id: 'u1',
    name,
    dose,
    frequency: null,
    start_date: '2026-08-01',
    end_date: null,
    notes: null,
    created_at: '',
    updated_at: '',
    intakes,
  }
}

describe('renderStackPdf', () => {
  it('produces a real PDF buffer', async () => {
    const buffer = await renderStackPdf(
      'upcoming',
      [
        supp('Magnesium', [
          { time: '08:00', amount: '1 capsule' },
          { time: '22:00', amount: '2 capsules' },
        ]),
        supp('Boron', []),
      ],
      '2026-08-16'
    )

    // %PDF- is the file signature; anything else means we produced junk.
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(buffer.byteLength).toBeGreaterThan(1000)
  }, 30_000)

  it('keeps a 40-entry schedule on a single page', async () => {
    // The PDF is a sheet you pin up, so density is the point of its type scale.
    // At the pre-OTH-37 sizes 40 entries spilled onto a second page; this pins
    // the gain so a future style tweak cannot quietly undo it.
    const times = ['07:30', '08:00', '10:00', '13:00', '18:30', '20:30', '22:30']
    const many = Array.from({ length: 40 }, (_, i) =>
      supp(`Supplement with a fairly long name ${i}`, [
        { time: times[i % times.length], amount: '2 capsules' },
      ])
    )
    const buffer = await renderStackPdf('upcoming', many, '2026-08-16')
    const pages = (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? [])
      .length
    // Guard the scrape itself: if a future jsPDF compresses its object
    // table the marker stops appearing as text, and a bare page assertion
    // would read as a density regression instead of a broken measurement.
    expect(pages, 'page markers not found — PDF internals changed').toBeGreaterThan(0)
    expect(pages).toBeLessThanOrEqual(1)
  }, 30_000)

  it('prints the title, date, groups and every row in schedule order', async () => {
    const buffer = await renderStackPdf(
      'active',
      [
        supp('Magnesium glycinate', [
          { time: '22:00', amount: '2 capsules' },
          { time: '08:00', amount: '1 capsule' },
        ]),
        supp('Vitamin D3 — 50 µg', [{ time: '08:00', amount: null }], null),
        supp('Boron', []),
      ],
      '2026-08-16'
    )
    expect(await pdfLines(buffer)).toEqual([
      [
        'Stack — Active',
        'Generated 2026-08-16',
        '08:00 | 2 items',
        'Magnesium glycinate | 400 mg | 1 capsule',
        'Vitamin D3 — 50 µg | — | —'.normalize('NFKC'),
        '22:00 | 1 item',
        'Magnesium glycinate | 400 mg | 2 capsules',
        'No time set | 1 item',
        'Boron | 400 mg | —',
      ],
    ])
  }, 30_000)

  it('says so when the stack is empty', async () => {
    const buffer = await renderStackPdf('upcoming', [], '2026-08-16')
    expect(await pdfLines(buffer)).toEqual([
      ['Stack — Upcoming', 'Generated 2026-08-16', 'No supplements.'],
    ])
  }, 30_000)

  it('never splits a time group across two pages', async () => {
    // 90 single-time entries in 9 groups of 10 cannot fit one A4 sheet. Every
    // group header must land on the same page as all ten of its rows.
    const times = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00']
    const many = Array.from({ length: 90 }, (_, i) =>
      supp(`Supplement ${String(i).padStart(2, '0')}`, [
        { time: times[Math.floor(i / 10)], amount: '1' },
      ])
    )
    const pages = await pdfLines(await renderStackPdf('active', many, '2026-08-16'))
    expect(pages.length).toBeGreaterThan(1)
    for (const page of pages) {
      const headers = page.filter((l) => / \| 10 items$/.test(l)).length
      const rows = page.filter((l) => l.startsWith('Supplement ')).length
      expect(rows).toBe(headers * 10)
    }
  }, 30_000)

  it('prints names outside the PDF font readably instead of garbling the cell', async () => {
    const buffer = await renderStackPdf(
      'active',
      [
        supp('β-Alanine', [{ time: '08:00', amount: '3.2 g' }], null),
        supp('Vitamin K₂ (MK-7)', [{ time: '08:00', amount: null }], '200 µg'),
        supp('Ω-3 fish oil 🐟', [{ time: '08:00', amount: '2' }], '1 g'),
      ],
      '2026-08-16'
    )
    expect((await pdfLines(buffer))[0].slice(2)).toEqual([
      '08:00 | 3 items',
      // Sorted by the original names, where Greek letters come after Latin.
      'Vitamin K2 (MK-7) | 200 µg | —'.normalize('NFKC'),
      'beta-Alanine | — | 3.2 g',
      'Omega-3 fish oil ? | 1 g | 2',
    ])
  }, 30_000)

  it('continues a time group that is taller than a page on the next page', async () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      supp(`Supplement ${String(i).padStart(2, '0')}`, [{ time: '08:00', amount: '1' }])
    )
    const pages = await pdfLines(await renderStackPdf('active', many, '2026-08-16'))
    expect(pages.length).toBe(2)
    const rows = pages.flat().filter((l) => l.startsWith('Supplement '))
    expect(rows).toHaveLength(80)
    expect(pages[1][0]).toBe('08:00 (continued) | 80 items')
  }, 30_000)

  it('renders an empty stack without throwing', async () => {

    const buffer = await renderStackPdf('active', [], '2026-08-16')
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  }, 30_000)
})
