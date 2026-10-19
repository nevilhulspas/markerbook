import { describe, it, expect } from 'vitest'

import {
  buildNextToTestTable,
  DEFAULT_NTT_PDF_FORMAT,
  type NttPdfGroup,
} from '../export-next-to-test'

const groups: NttPdfGroup[] = [
  {
    label: 'Blood markers',
    rows: [
      { name: 'Anti-tTG IgA', source_label: 'Any lab', note: 'coeliac confirm', due_date: null, status: 'pending' },
      { name: 'Ferritin', source_label: 'BODIMED', note: null, due_date: '2026-06-10', status: 'done' },
    ],
  },
  {
    label: 'Other',
    rows: [
      { name: 'SIBO Breath Test', source_label: '—', note: 'Genomic Center', due_date: null, status: 'pending' },
    ],
  },
]

describe('buildNextToTestTable', () => {
  it('includes # + Name always and the selected optional columns, in canonical order', () => {
    const { head } = buildNextToTestTable(groups, DEFAULT_NTT_PDF_FORMAT)
    expect(head).toEqual(['#', 'Name', 'Source', 'Note', 'Due', 'Status'])

    // Input order is ignored — canonical order (source, note, due, status) is kept.
    const { head: subset } = buildNextToTestTable(groups, { columns: ['status', 'note'] })
    expect(subset).toEqual(['#', 'Name', 'Note', 'Status'])
  })

  it('emits a section row per non-empty group (order preserved) then numbered entry rows', () => {
    const { body } = buildNextToTestTable(groups, DEFAULT_NTT_PDF_FORMAT)
    expect(body.map((r) => (r.kind === 'section' ? `#${r.label}` : r.cells[1]))).toEqual([
      '#Blood markers',
      'Anti-tTG IgA',
      'Ferritin',
      '#Other',
      'SIBO Breath Test',
    ])
    // Numbering restarts at 1 within each group.
    const rowNums = body.filter((r) => r.kind === 'row').map((r) => (r as { cells: string[] }).cells[0])
    expect(rowNums).toEqual(['1', '2', '1'])
  })

  it('maps cell values and renders — for empty source/note/due', () => {
    const { body } = buildNextToTestTable(groups, DEFAULT_NTT_PDF_FORMAT)
    const ferritin = body.find((r) => r.kind === 'row' && r.cells[1] === 'Ferritin') as { cells: string[] }
    // [#, Name, Source, Note, Due, Status]
    expect(ferritin.cells).toEqual(['2', 'Ferritin', 'BODIMED', '—', '2026-06-10', 'done'])
    const antiTtg = body.find((r) => r.kind === 'row' && r.cells[1] === 'Anti-tTG IgA') as { cells: string[] }
    expect(antiTtg.cells).toEqual(['1', 'Anti-tTG IgA', 'Any lab', 'coeliac confirm', '—', 'pending'])
  })

  it('drops empty groups and handles no input', () => {
    const withEmpty: NttPdfGroup[] = [...groups, { label: 'DEXA', rows: [] }]
    const { body } = buildNextToTestTable(withEmpty, DEFAULT_NTT_PDF_FORMAT)
    expect(body.some((r) => r.kind === 'section' && r.label === 'DEXA')).toBe(false)

    const empty = buildNextToTestTable([], DEFAULT_NTT_PDF_FORMAT)
    expect(empty.body).toEqual([])
    expect(empty.head).toEqual(['#', 'Name', 'Source', 'Note', 'Due', 'Status'])
  })

  it('with no optional columns still emits # + Name', () => {
    const { head, body } = buildNextToTestTable(groups, { columns: [] })
    expect(head).toEqual(['#', 'Name'])
    const firstRow = body.find((r) => r.kind === 'row') as { cells: string[] }
    expect(firstRow.cells).toEqual(['1', 'Anti-tTG IgA'])
  })
})
