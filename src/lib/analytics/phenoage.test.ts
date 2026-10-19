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
      albumin: 4.0,
      creatinine: 1.0,
      glucose: 100,
      crp: 1.5,
      lymphocytePercent: 28,
      mcv: 89,
      rdw: 13.5,
      alkalinePhosphatase: 60,
      wbc: 6.0,
    })

    // Levine 2018 formula with ln(glucose) and CRP converted from mg/L to mg/dL
    // produces ~54.5 for these healthy-ish inputs (younger than chronological age 55)
    expect(result).toBeCloseTo(54.5, 0)
  })

  it('returns NaN when CRP is 0 (ln(0) guard)', () => {
    const result = calculatePhenoAge({
      age: 55,
      albumin: 4.0,
      creatinine: 1.0,
      glucose: 100,
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
      albumin: 4.0,
      creatinine: 1.0,
      glucose: 90,
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
      albumin: 4.5,
      creatinine: 0.9,
      glucose: 85,
      crp: 0.5,
      lymphocytePercent: 32,
      mcv: 88,
      rdw: 12.5,
      alkalinePhosphatase: 55,
      wbc: 5.5,
    })

    const unhealthy = calculatePhenoAge({
      age: 55,
      albumin: 3.0,
      creatinine: 1.5,
      glucose: 130,
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
