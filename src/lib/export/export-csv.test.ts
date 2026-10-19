import { describe, it, expect } from 'vitest'
import { buildCsvContent, escapeCsv } from './export-csv'
import type { GridData } from '@/lib/grid/grid-types'
import type { Biomarker } from '@/lib/database.types'

function makeBiomarker(overrides: Partial<Biomarker> = {}): Biomarker {
  return {
    id: 'bm-1',
    name: 'Hemoglobin',
    short_name: 'Hgb',
    unit: 'g/dL',
    category: 'Hematology',
    description: null,
    aliases: null,
    sample_type: 'blood',
    ref_range_low: 12,
    ref_range_high: 17,
    ref_range_low_male: null,
    ref_range_high_male: null,
    ref_range_low_female: null,
    ref_range_high_female: null,
    created_at: '',
    parent_id: null,
    display_order: null,
    panel_id: null,
    is_parent: false,
    ...overrides,
  } as Biomarker
}

function makeGridData(overrides: Partial<GridData> = {}): GridData {
  return {
    rows: [
      {
        biomarker: makeBiomarker(),
        category: 'Hematology',
        values: {
          'test-1': { value: 14.5, unit: 'g/dL', resultId: 'r1' },
          'test-2': { value: 15.2, unit: 'g/dL', resultId: 'r2' },
        },
      },
    ],
    testDates: [
      { id: 'test-1', date: '2025-01-15', name: 'Blood Test Jan' },
      { id: 'test-2', date: '2025-06-20', name: 'Blood Test Jun' },
    ],
    ...overrides,
  }
}

describe('escapeCsv', () => {
  it('returns plain values unchanged', () => {
    expect(escapeCsv('hello')).toBe('hello')
  })

  it('wraps values containing commas in double quotes', () => {
    expect(escapeCsv('hello, world')).toBe('"hello, world"')
  })

  it('doubles internal quotes and wraps in quotes', () => {
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""')
  })

  it('wraps values containing newlines', () => {
    expect(escapeCsv('line1\nline2')).toBe('"line1\nline2"')
  })
})

describe('buildCsvContent', () => {
  it('starts with UTF-8 BOM', () => {
    const csv = buildCsvContent(makeGridData())
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('has correct header row with Category, Marker, Unit, then test dates', () => {
    const csv = buildCsvContent(makeGridData())
    const lines = csv.split('\n')
    // Skip BOM character in first line
    const headerLine = lines[0].substring(1) // remove BOM
    expect(headerLine).toBe('Category,Marker,Unit,2025-01-15,2025-06-20')
  })

  it('places values in correct columns for matching test IDs', () => {
    const csv = buildCsvContent(makeGridData())
    const lines = csv.split('\n')
    const dataLine = lines[1]
    expect(dataLine).toBe('Hematology,Hemoglobin,g/dL,14.5,15.2')
  })

  it('produces empty fields for missing values', () => {
    const data = makeGridData({
      rows: [
        {
          biomarker: makeBiomarker(),
          category: 'Hematology',
          values: {
            'test-1': { value: 14.5, unit: 'g/dL', resultId: 'r1' },
            'test-2': null,
          },
        },
      ],
    })
    const csv = buildCsvContent(data)
    const lines = csv.split('\n')
    const dataLine = lines[1]
    expect(dataLine).toBe('Hematology,Hemoglobin,g/dL,14.5,')
  })

  it('escapes values containing commas or quotes', () => {
    const data = makeGridData({
      rows: [
        {
          biomarker: makeBiomarker({ name: 'Vitamin B12, Total', unit: 'pg/mL' }),
          category: 'Vitamins',
          values: {
            'test-1': { value: 400, unit: 'pg/mL', resultId: 'r1' },
            'test-2': null,
          },
        },
      ],
    })
    const csv = buildCsvContent(data)
    const lines = csv.split('\n')
    const dataLine = lines[1]
    expect(dataLine).toBe('Vitamins,"Vitamin B12, Total",pg/mL,400,')
  })
})

describe('buildCsvContent unit safety', () => {
  it('writes a cell that is in another unit with that unit', () => {
    const csv = buildCsvContent({
      testDates: [{ id: 't1', date: '2026-01-01', name: 'A' }, { id: 't2', date: '2026-02-01', name: 'B' }],
      rows: [
        {
          biomarker: { id: 'b', name: 'Hemoglobin', unit: 'g/dL' } as never,
          category: 'Blood',
          values: {
            t1: { value: 14.5, unit: 'g/dL', resultId: 'r1' },
            t2: { value: 9, unit: 'mmol/L', resultId: 'r2' },
          },
        },
      ],
    } as never)
    expect(csv).toContain('Blood,Hemoglobin,g/dL,14.5,9 mmol/L')
  })
})
