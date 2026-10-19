import { describe, it, expect } from 'vitest'

import {
  findReferenceRange,
  getRangeStatusFromRanges,
  getRangeStatus,
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
