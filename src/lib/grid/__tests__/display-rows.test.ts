import { describe, it, expect } from 'vitest'

import type { Annotation, Biomarker, BiomarkerUnit, ReferenceRange } from '@/lib/database.types'
import type { GridRow } from '@/lib/grid/grid-types'
import {
  convertRowsToDisplayUnits,
  filterRowsByCategoryAndStatus,
  filterTestDatesByRange,
  mergeAnnotationDateColumns,
} from '@/lib/grid/display-rows'

const T1 = { id: 't1', date: '2026-01-10', name: 'Jan' }
const T2 = { id: 't2', date: '2026-03-05', name: 'Mar' }
const T3 = { id: 't3', date: '2026-06-20', name: 'Jun' }
const TEST_DATES = [T1, T2, T3]

function biomarker(overrides: Partial<Biomarker> = {}): Biomarker {
  return {
    id: 'bm-glucose',
    name: 'Glucose',
    short_name: null,
    category: 'Metabolic',
    unit: 'mmol/L',
    description: null,
    ref_range_low: 4,
    ref_range_high: 6,
    ref_range_low_male: null,
    ref_range_high_male: null,
    ref_range_low_female: null,
    ref_range_high_female: null,
    range_source: null,
    aliases: [],
    parent_id: null,
    variant_name: null,
    panel_id: null,
    archived_at: null,
    loinc_code: null,
    is_custom: false,
    method: null,
    created_at: '2026-01-01',
    ...overrides,
  }
}

function unit(u: string, factor: number, isDefault = false): BiomarkerUnit {
  return { id: `u-${u}`, biomarker_id: 'bm-glucose', unit: u, is_default: isDefault, conversion_factor: factor, created_at: '' }
}

function range(u: string, low: number | null, high: number | null): ReferenceRange {
  return {
    id: `r-${u}`,
    biomarker_id: 'bm-glucose',
    unit: u,
    sex: 'general',
    age_min: null,
    age_max: null,
    range_low: low,
    range_high: high,
    source: 'test',
    source_url: null,
    verified_at: null,
    verified_by: null,
    range_type: 'normal',
    phase: null,
    created_at: '',
  }
}

function row(overrides: Partial<GridRow> = {}): GridRow {
  return { biomarker: biomarker(), category: 'Metabolic', values: {}, ...overrides }
}

function annotation(date: string, end_date: string | null = null): Annotation {
  return { id: `a-${date}`, date, end_date, title: 'note' } as Annotation
}

describe('filterTestDatesByRange', () => {
  it('returns the same array when no range is set', () => {
    expect(filterTestDatesByRange(TEST_DATES, undefined, undefined)).toBe(TEST_DATES)
  })

  it('keeps dates inside an inclusive range', () => {
    expect(filterTestDatesByRange(TEST_DATES, '2026-03-05', '2026-06-20')).toEqual([T2, T3])
    expect(filterTestDatesByRange(TEST_DATES, undefined, '2026-03-04')).toEqual([T1])
    expect(filterTestDatesByRange(TEST_DATES, '2026-03-06', undefined)).toEqual([T3])
  })
})

describe('mergeAnnotationDateColumns', () => {
  it('returns the test dates unchanged when every annotation falls on a test date', () => {
    const result = mergeAnnotationDateColumns(TEST_DATES, [annotation('2026-01-10')])
    expect(result.mergedDateColumns).toBe(TEST_DATES)
    expect(result.annotationOnlyIds.size).toBe(0)
  })

  it('adds annotation-only start and end dates as sorted synthetic columns, once each', () => {
    const result = mergeAnnotationDateColumns(TEST_DATES, [
      annotation('2026-02-01', '2026-07-01'),
      annotation('2026-02-01'),
    ])
    expect(result.mergedDateColumns.map((c) => c.id)).toEqual(['t1', 'ann-2026-02-01', 't2', 't3', 'ann-2026-07-01'])
    expect(result.mergedDateColumns.find((c) => c.id === 'ann-2026-02-01')).toEqual({
      id: 'ann-2026-02-01',
      date: '2026-02-01',
      name: '',
    })
    expect([...result.annotationOnlyIds]).toEqual(['ann-2026-02-01', 'ann-2026-07-01'])
  })
})

describe('filterRowsByCategoryAndStatus', () => {
  const metabolic = row({ values: { t1: { value: 5, unit: 'mmol/L', resultId: 'r1' } } })
  const lipid = row({
    biomarker: biomarker({ id: 'bm-ldl', name: 'LDL' }),
    category: 'Lipids',
    values: { t2: { value: 9, unit: 'mmol/L', resultId: 'r2' } },
  })

  it('returns the same array with no filters', () => {
    const rows = [metabolic, lipid]
    expect(filterRowsByCategoryAndStatus(rows, { testDates: TEST_DATES })).toBe(rows)
  })

  it('filters by category', () => {
    expect(filterRowsByCategoryAndStatus([metabolic, lipid], { categories: ['Lipids'], testDates: TEST_DATES })).toEqual([lipid])
  })

  it('keeps rows with at least one visible cell in a selected status (inline biomarker range)', () => {
    const rows = [metabolic, lipid]
    expect(filterRowsByCategoryAndStatus(rows, { status: ['normal'], testDates: TEST_DATES })).toEqual([metabolic])
    expect(filterRowsByCategoryAndStatus(rows, { status: ['out-of-range'], testDates: TEST_DATES })).toEqual([lipid])
    // Only visible test dates count.
    expect(filterRowsByCategoryAndStatus(rows, { status: ['out-of-range'], testDates: [T1] })).toEqual([])
  })

  it('judges a cell by its own unit against the reference ranges table', () => {
    const r = row({
      referenceRanges: [range('mg/dL', 70, 100)],
      values: { t1: { value: 90, unit: 'mg/dL', resultId: 'r1' } },
    })
    expect(filterRowsByCategoryAndStatus([r], { status: ['normal'], testDates: TEST_DATES })).toEqual([r])
  })

  it('treats a cell in another unit as unknown when only the inline range exists', () => {
    const r = row({ values: { t1: { value: 90, unit: 'mg/dL', resultId: 'r1' } } })
    expect(filterRowsByCategoryAndStatus([r], { status: ['unknown'], testDates: TEST_DATES })).toEqual([r])
  })
})

describe('convertRowsToDisplayUnits', () => {
  const units = [unit('mmol/L', 1, true), unit('mg/dL', 1 / 18)]

  it('leaves rows with one or no unit untouched', () => {
    const r = row({ values: { t1: { value: 5, unit: 'mmol/L', resultId: 'r1' } } })
    expect(convertRowsToDisplayUnits([r], new Map(), TEST_DATES)[0]).toBe(r)
  })

  it('uses the most recent lab unit when there is no user preference', () => {
    const r = row({
      units,
      values: {
        t1: { value: 5, unit: 'mmol/L', resultId: 'r1' },
        t2: { value: 99, unit: 'mg/dL', resultId: 'r2' },
      },
    })
    const [out] = convertRowsToDisplayUnits([r], new Map(), TEST_DATES)
    expect(out.biomarker.unit).toBe('mg/dL')
    expect(out.values.t1).toEqual({ value: 90, unit: 'mg/dL', resultId: 'r1' })
    expect(out.values.t2).toBe(r.values.t2)
  })

  it('prefers the user preference and rounds to one decimal', () => {
    const r = row({ units, values: { t1: { value: 99, unit: 'mg/dL', resultId: 'r1' } } })
    const [out] = convertRowsToDisplayUnits([r], new Map([['bm-glucose', 'mmol/L']]), TEST_DATES)
    expect(out.values.t1).toEqual({ value: 5.5, unit: 'mmol/L', resultId: 'r1' })
    expect(out.biomarker).toBe(r.biomarker) // catalog unit already mmol/L
  })

  it('maps the display unit to the catalog spelling', () => {
    const r = row({ units, values: { t1: { value: 99, unit: 'mg/dl', resultId: 'r1' } } })
    const [out] = convertRowsToDisplayUnits([r], new Map(), TEST_DATES)
    expect(out.biomarker.unit).toBe('mg/dL')
  })

  it('keeps a cell that cannot be converted in its original unit', () => {
    const r = row({
      units,
      values: {
        t1: { value: 3, unit: 'g/L', resultId: 'r1' },
        t2: { value: 5, unit: 'mmol/L', resultId: 'r2' },
      },
    })
    const [out] = convertRowsToDisplayUnits([r], new Map(), TEST_DATES)
    expect(out.values).toBe(r.values) // nothing converted
  })

  it('converts reference ranges and nulls a bound that cannot be converted', () => {
    const r = row({
      units,
      referenceRanges: [range('mmol/L', 4, 6), range('mg/dL', 70, 100), range('g/L', 1, 2)],
      values: { t1: { value: 5, unit: 'mmol/L', resultId: 'r1' } },
    })
    const [out] = convertRowsToDisplayUnits([r], new Map(), TEST_DATES)
    expect(out.referenceRanges?.[0]).toBe(r.referenceRanges?.[0])
    expect(out.referenceRanges?.[1].range_low).toBeCloseTo(70 / 18)
    expect(out.referenceRanges?.[1].unit).toBe('mmol/L')
    expect(out.referenceRanges?.[2]).toMatchObject({ range_low: null, range_high: null, unit: 'mmol/L' })
  })
})
