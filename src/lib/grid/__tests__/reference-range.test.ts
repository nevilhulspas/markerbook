import { describe, it, expect } from 'vitest'

import {
  findReferenceRange,
  getRangeStatusFromRanges,
  getRangeStatus,
  classifyValue,
  inlineRange,
} from '@/lib/grid/reference-range'
import type { Biomarker, ReferenceRange } from '@/lib/database.types'

function makeRange(overrides: Partial<ReferenceRange> = {}): ReferenceRange {
  return {
    id: 'rr-1',
    biomarker_id: 'bm-1',
    unit: 'mg/dL',
    sex: 'general',
    age_min: null,
    age_max: null,
    range_low: 70,
    range_high: 99,
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

const NORMAL = makeRange()
const OPTIMAL = makeRange({ id: 'rr-2', range_low: 75, range_high: 90, range_type: 'optimal' })

function makeBiomarker(overrides: Partial<Biomarker> = {}): Biomarker {
  return {
    id: 'bm-1',
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

describe('findReferenceRange', () => {
  it('returns the normal range for a normal lookup when only normal ranges exist', () => {
    expect(findReferenceRange([NORMAL], 'mg/dL', null, null, 'normal')).toEqual({
      low: 70,
      high: 99,
    })
  })

  it('returns null for a normal lookup when ONLY optimal ranges exist — optimal must never masquerade as normal', () => {
    expect(findReferenceRange([OPTIMAL], 'mg/dL', null, null, 'normal')).toEqual({
      low: null,
      high: null,
    })
  })

  it('ignores optimal ranges for a normal lookup even when both types exist', () => {
    expect(findReferenceRange([OPTIMAL, NORMAL], 'mg/dL', null, null, 'normal')).toEqual({
      low: 70,
      high: 99,
    })
  })

  it('returns the optimal range for an optimal lookup when it exists', () => {
    expect(findReferenceRange([OPTIMAL, NORMAL], 'mg/dL', null, null, 'optimal')).toEqual({
      low: 75,
      high: 90,
    })
  })

  it('returns null for an optimal lookup when no optimal range exists', () => {
    expect(findReferenceRange([NORMAL], 'mg/dL', null, null, 'optimal')).toEqual({
      low: null,
      high: null,
    })
  })

  it('matches by unit', () => {
    const mmol = makeRange({ unit: 'mmol/L', range_low: 3.9, range_high: 5.6 })
    expect(findReferenceRange([NORMAL, mmol], 'mmol/L', null, null, 'normal')).toEqual({
      low: 3.9,
      high: 5.6,
    })
  })
})

describe('getRangeStatusFromRanges', () => {
  it('reports unknown (not out-of-range) when only optimal ranges exist', () => {
    // 5.5 mmol/L glucose would be judged "out of range" against the functional
    // 75-90 mg/dL range — but there is no NORMAL range to judge it by.
    expect(getRangeStatusFromRanges(5.5, [OPTIMAL], 'mg/dL')).toBe('unknown')
  })

  it('classifies against the requested unit’s normal range', () => {
    const mmol = makeRange({ unit: 'mmol/L', range_low: 3.9, range_high: 5.6 })
    expect(getRangeStatusFromRanges(5.5, [NORMAL, mmol], 'mmol/L')).toBe('normal')
    expect(getRangeStatusFromRanges(6.1, [NORMAL, mmol], 'mmol/L')).toBe('out-of-range')
  })
})

describe('getRangeStatus (inline fallback)', () => {
  it('uses sex-specific bounds only when they are complete', () => {
    const bm = makeBiomarker({ ref_range_low_female: 65, ref_range_high_female: 95 })
    // Female user: complete female bounds win.
    expect(getRangeStatus(80, bm, 'female')).toBe('normal')
    // Male user: general bounds apply.
    expect(getRangeStatus(80, bm, 'male')).toBe('normal')
    // Female value outside female bounds is flagged.
    expect(getRangeStatus(60, bm, 'female')).toBe('out-of-range')
  })
})

describe('one-sided ranges and the capped borderline margin', () => {
  it('judges an upper-limit-only range (< 5)', () => {
    expect(classifyValue(3, null, 5)).toBe('normal')
    expect(classifyValue(5.3, null, 5)).toBe('borderline')
    expect(classifyValue(9, null, 5)).toBe('out-of-range')
  })

  it('judges a lower-limit-only range (> 60)', () => {
    expect(classifyValue(75, 60, null)).toBe('normal')
    expect(classifyValue(57, 60, null)).toBe('borderline')
    expect(classifyValue(30, 60, null)).toBe('out-of-range')
  })

  it('returns unknown without any bound', () => {
    expect(classifyValue(3, null, null)).toBe('unknown')
  })

  it('flags a very low eGFR against 90–999 as out of range', () => {
    expect(classifyValue(20, 90, 999)).toBe('out-of-range')
    expect(classifyValue(85, 90, 999)).toBe('borderline')
  })

  it('keeps the usual 10%-of-span margin for a normal range', () => {
    // Bilirubin 0.1–1.2: margin 0.11 below, capped at 0.05 by the bound.
    expect(classifyValue(0.08, 0.1, 1.2)).toBe('borderline')
    expect(classifyValue(1.3, 0.1, 1.2)).toBe('borderline')
    expect(classifyValue(1.4, 0.1, 1.2)).toBe('out-of-range')
  })

  it('uses a one-sided male inline range', () => {
    const bm = {
      ref_range_low: null, ref_range_high: 10,
      ref_range_low_male: null, ref_range_high_male: 5,
      ref_range_low_female: null, ref_range_high_female: null,
    }
    expect(inlineRange(bm, 'male')).toEqual({ low: null, high: 5 })
    expect(inlineRange(bm, 'female')).toEqual({ low: null, high: 10 })
  })
})
