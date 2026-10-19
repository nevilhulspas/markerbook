import { describe, it, expect } from 'vitest'

import { buildTrendData } from '@/lib/analytics/marker-trends'
import type { Biomarker, BiomarkerUnit, ReferenceRange } from '@/lib/database.types'
import type { GridRow } from '@/lib/grid/grid-types'

function makeBiomarker(overrides: Partial<Biomarker> = {}): Biomarker {
  return {
    id: 'bm-glucose',
    name: 'Glucose',
    short_name: 'Glu',
    unit: 'mg/dL',
    category: 'Metabolic',
    description: null,
    aliases: null,
    sample_type: 'blood',
    ref_range_low: 70,
    ref_range_high: 99,
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

function makeRange(unit: string, low: number, high: number): ReferenceRange {
  return {
    id: `rr-${unit}`,
    biomarker_id: 'bm-glucose',
    unit,
    sex: 'general',
    age_min: null,
    age_max: null,
    range_low: low,
    range_high: high,
    range_type: 'normal',
    source: 'test',
    source_url: null,
    verified_at: null,
    verified_by: null,
    phase: null,
    created_at: '',
  }
}

// Glucose catalog: mg/dL default, mmol/L with conversion factor 18.0182.
const glucoseUnits = [
  { unit: 'mg/dL', conversion_factor: 1.0, is_default: true },
  { unit: 'mmol/L', conversion_factor: 18.0182, is_default: false },
] as unknown as BiomarkerUnit[]

const testDates = [
  { id: 't1', date: '2025-01-01', name: 'Test 1' },
  { id: 't2', date: '2025-06-01', name: 'Test 2' },
]

describe('buildTrendData', () => {
  it('converts each point to the marker unit so the chart axis is consistent', () => {
    const row: GridRow = {
      biomarker: makeBiomarker(),
      category: 'Metabolic',
      units: glucoseUnits,
      referenceRanges: [makeRange('mg/dL', 70, 99)],
      values: {
        t1: { value: 5.2, unit: 'mmol/L', resultId: 'r1' },
        t2: { value: 99, unit: 'mg/dL', resultId: 'r2' },
      },
    }

    const trend = buildTrendData(row, testDates)

    // 5.2 mmol/L * 18.0182 ≈ 93.7 mg/dL — plotted on the same axis as 99.
    expect(trend.points).toHaveLength(2)
    expect(trend.points[0].value).toBeCloseTo(93.7, 1)
    expect(trend.points[0].unit).toBe('mg/dL')
    expect(trend.points[1]).toMatchObject({ value: 99, unit: 'mg/dL' })
    expect(trend.unit).toBe('mg/dL')
    expect(trend.refLow).toBe(70)
    expect(trend.refHigh).toBe(99)
  })

  it('drops an un-convertible point instead of plotting it on the wrong axis', () => {
    // Legacy mmol/L reading for a catalog that only knows mg/dL + g/L: it
    // cannot be placed on the g/dL axis, so it must not be plotted (a raw
    // 10.4 would read as "10.4 g/L" next to the 12-17 reference band).
    const hgbUnits = [
      { unit: 'g/dL', conversion_factor: 1.0, is_default: true },
      { unit: 'g/L', conversion_factor: 0.1, is_default: false },
    ] as unknown as BiomarkerUnit[]
    const row: GridRow = {
      biomarker: makeBiomarker({ unit: 'g/dL', name: 'Hemoglobin', short_name: 'Hgb' }),
      category: 'Hematology',
      units: hgbUnits,
      referenceRanges: [makeRange('g/dL', 12, 17)],
      values: {
        t1: { value: 10.4, unit: 'mmol/L', resultId: 'r1' },
        t2: { value: 15.9, unit: 'g/dL', resultId: 'r2' },
      },
    }

    const trend = buildTrendData(row, testDates)

    expect(trend.points).toHaveLength(1)
    expect(trend.points[0]).toMatchObject({ value: 15.9, unit: 'g/dL' })
    expect(trend.unit).toBe('g/dL')
  })
})
