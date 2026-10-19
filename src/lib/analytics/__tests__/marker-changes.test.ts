import { describe, it, expect } from 'vitest'

import { computeMarkerChanges } from '@/lib/analytics/marker-changes'
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

function makeRange(unit: string, low: number, high: number, overrides: Partial<ReferenceRange> = {}): ReferenceRange {
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
    ...overrides,
  }
}

function makeRow(overrides: Partial<GridRow> = {}): GridRow {
  return {
    biomarker: makeBiomarker(),
    category: 'Metabolic',
    values: {
      old: { value: 5.2, unit: 'mmol/L', resultId: 'r-old' },
      latest: { value: 5.5, unit: 'mmol/L', resultId: 'r-latest' },
    },
    ...overrides,
  }
}

// Glucose catalog: mg/dL default, mmol/L with conversion factor 18.0182.
const glucoseUnits = [
  { unit: 'mg/dL', conversion_factor: 1.0, is_default: true },
  { unit: 'mmol/L', conversion_factor: 18.0182, is_default: false },
] as unknown as BiomarkerUnit[]

describe('computeMarkerChanges', () => {
  it('classifies each test against a range in THAT test’s own unit', () => {
    const ranges = [makeRange('mg/dL', 70, 99), makeRange('mmol/L', 3.9, 5.6)]
    const row = makeRow({
      biomarker: makeBiomarker({ unit: 'mg/dL' }),
      units: glucoseUnits,
      referenceRanges: ranges,
    })

    const changes = computeMarkerChanges([row], 'latest', 'old')

    // 5.5 mmol/L is NORMAL (3.9-5.6). The old bug compared it against the
    // mg/dL range and reported "out of range".
    expect(changes).toHaveLength(1)
    expect(changes[0].status).toBe('normal')
    expect(changes[0].previousStatus).toBe('normal')
  })

  it('reports unknown (not out-of-range) when the cell unit has no matching range', () => {
    // Catalog knows only mg/dL; the stored reading is legacy mmol/L with no
    // factor — the honest answer is "no reference", not a wrong-scale verdict.
    const ranges = [makeRange('mg/dL', 70, 99)]
    const row = makeRow({
      biomarker: makeBiomarker({ unit: 'mg/dL' }),
      units: glucoseUnits,
      referenceRanges: ranges,
    })

    const changes = computeMarkerChanges([row], 'latest', 'old')

    expect(changes).toHaveLength(1)
    expect(changes[0].status).toBe('unknown')
    expect(changes[0].previousStatus).toBe('unknown')
  })

  it('falls back to inline ranges only when the cell unit matches the biomarker unit', () => {
    // Same-unit inline path still works.
    const rowSameUnit = makeRow({
      biomarker: makeBiomarker({ unit: 'mg/dL' }),
      values: {
        old: { value: 90, unit: 'mg/dL', resultId: 'r-old' },
        latest: { value: 95, unit: 'mg/dL', resultId: 'r-latest' },
      },
    })
    const sameUnitChanges = computeMarkerChanges([rowSameUnit], 'latest', 'old')
    expect(sameUnitChanges[0].status).toBe('normal')

    // Mismatched unit + no enriched ranges -> unknown, not judged against the
    // wrong scale.
    const rowMismatch = makeRow({
      biomarker: makeBiomarker({ unit: 'mg/dL' }),
      units: glucoseUnits,
      values: {
        old: { value: 5.2, unit: 'mmol/L', resultId: 'r-old' },
        latest: { value: 5.5, unit: 'mmol/L', resultId: 'r-latest' },
      },
    })
    const mismatchChanges = computeMarkerChanges([rowMismatch], 'latest', 'old')
    expect(mismatchChanges[0].status).toBe('unknown')
  })
})
