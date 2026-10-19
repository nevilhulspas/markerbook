import { describe, it, expect } from 'vitest'
import {
  calculatePhenoAge,
  checkPhenoAgeReadiness,
  PHENOAGE_MARKERS,
} from './phenoage'
import type { GridRow } from '@/lib/grid/grid-types'
import type { Biomarker } from '@/lib/database.types'

function makeBiomarker(overrides: Partial<Biomarker>): Biomarker {
  return {
    id: overrides.id ?? 'test-id',
    name: overrides.name ?? 'Test',
    short_name: overrides.short_name ?? null,
    category: overrides.category ?? 'test',
    unit: overrides.unit ?? 'mg/dL',
    description: null,
    ref_range_low: null,
    ref_range_high: null,
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
    created_at: '2024-01-01T00:00:00Z',
  }
}

function makeGridRow(
  name: string,
  shortName: string | null,
  testId: string,
  value: number | null
): GridRow {
  return {
    biomarker: makeBiomarker({ name, short_name: shortName }),
    category: 'test',
    values:
      value != null
        ? { [testId]: { value, unit: 'test', resultId: 'r1' } }
        : {},
  }
}

describe('calculatePhenoAge', () => {
  it('returns correct biological age for known healthy inputs', () => {
    const result = calculatePhenoAge({
      age: 55,
      albumin: 40.0,
      creatinine: 88.4,
      glucose: 5.5494,
      crp: 1.5,
      lymphocytePercent: 28,
      mcv: 89,
      rdw: 13.5,
      alkalinePhosphatase: 60,
      wbc: 6.0,
    })

    // Levine 2018 (Table S1 units: albumin g/L, creatinine µmol/L, glucose
    // mmol/L, CRP ln(mg/dL)) gives ~52.3 for these inputs
    // (albumin 4.0 g/dL, creatinine 1.0 mg/dL, glucose 100 mg/dL).
    expect(result).toBeCloseTo(52.3, 0)
  })

  it('returns NaN when CRP is 0 (ln(0) guard)', () => {
    const result = calculatePhenoAge({
      age: 55,
      albumin: 40.0,
      creatinine: 88.4,
      glucose: 5.5494,
      crp: 0,
      lymphocytePercent: 28,
      mcv: 89,
      rdw: 13.5,
      alkalinePhosphatase: 60,
      wbc: 6.0,
    })

    expect(result).toBeNaN()
  })

  it('returns NaN when CRP is negative', () => {
    const result = calculatePhenoAge({
      age: 40,
      albumin: 40.0,
      creatinine: 88.4,
      glucose: 4.9945,
      crp: -1,
      lymphocytePercent: 30,
      mcv: 85,
      rdw: 12.5,
      alkalinePhosphatase: 50,
      wbc: 5.5,
    })

    expect(result).toBeNaN()
  })

  it('returns a higher biological age for worse markers', () => {
    const healthy = calculatePhenoAge({
      age: 55,
      albumin: 45.0,
      creatinine: 79.56,
      glucose: 4.717,
      crp: 0.5,
      lymphocytePercent: 32,
      mcv: 88,
      rdw: 12.5,
      alkalinePhosphatase: 55,
      wbc: 5.5,
    })

    const unhealthy = calculatePhenoAge({
      age: 55,
      albumin: 30.0,
      creatinine: 132.6,
      glucose: 7.2142,
      crp: 8.0,
      lymphocytePercent: 15,
      mcv: 105,
      rdw: 16.5,
      alkalinePhosphatase: 120,
      wbc: 12.0,
    })

    expect(unhealthy).toBeGreaterThan(healthy)
  })
})

describe('checkPhenoAgeReadiness', () => {
  const testId = 'test-1'

  it('returns ready=true when all 9 markers are present', () => {
    const rows: GridRow[] = PHENOAGE_MARKERS.map((m) =>
      makeGridRow(m.catalogName, null, testId, 5.0)
    )

    const result = checkPhenoAgeReadiness(rows, testId)

    expect(result.ready).toBe(true)
    expect(result.present).toHaveLength(9)
    expect(result.missing).toHaveLength(0)
    expect(result.presentCount).toBe(9)
    expect(result.totalRequired).toBe(9)
  })

  it('returns ready=false with correct present/missing for 6 of 9 markers', () => {
    const rows: GridRow[] = PHENOAGE_MARKERS.slice(0, 6).map((m) =>
      makeGridRow(m.catalogName, null, testId, 5.0)
    )

    const result = checkPhenoAgeReadiness(rows, testId)

    expect(result.ready).toBe(false)
    expect(result.present).toHaveLength(6)
    expect(result.missing).toHaveLength(3)
    expect(result.presentCount).toBe(6)
  })

  it('returns ready=false with all missing when no matching markers', () => {
    const rows: GridRow[] = [
      makeGridRow('Unrelated Marker', null, testId, 10),
    ]

    const result = checkPhenoAgeReadiness(rows, testId)

    expect(result.ready).toBe(false)
    expect(result.present).toHaveLength(0)
    expect(result.missing).toHaveLength(9)
    expect(result.presentCount).toBe(0)
  })

  it('handles markers matched by short_name', () => {
    const rows: GridRow[] = [
      makeGridRow('Some Other Name', 'Albumin', testId, 4.0),
    ]

    const result = checkPhenoAgeReadiness(rows, testId)

    expect(result.present).toContain('Albumin')
    expect(result.presentCount).toBe(1)
  })

  it('treats null value as missing', () => {
    const rows: GridRow[] = [
      makeGridRow('Albumin', null, testId, null), // exists but no value
    ]

    const result = checkPhenoAgeReadiness(rows, testId)

    expect(result.present).not.toContain('Albumin')
    expect(result.missing).toContain('Albumin')
  })
})

describe('calculatePhenoAge worked example', () => {
  it('matches the published formula (~27.8) for a 37-year-old', () => {
    const age = calculatePhenoAge({
      age: 37,
      albumin: 45, // 4.5 g/dL
      creatinine: 0.9 * 88.4, // 0.9 mg/dL
      glucose: 85 / 18.02, // 85 mg/dL
      crp: 0.5,
      lymphocytePercent: 31,
      mcv: 89.5,
      rdw: 12.8,
      alkalinePhosphatase: 55,
      wbc: 6.5,
    })
    expect(age).toBeCloseTo(27.8, 0)
  })
})
