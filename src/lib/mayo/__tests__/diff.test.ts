import { describe, it, expect } from 'vitest'
import { computeRangeDiff } from '../diff'
import type { ReferenceRange } from '@/lib/database.types'
import type { ParsedMayoRange } from '../types'

function makeRange(overrides: Partial<ReferenceRange> = {}): ReferenceRange {
  return {
    id: 'range-1',
    biomarker_id: 'bio-1',
    unit: 'mg/dL',
    sex: 'general',
    age_min: null,
    age_max: null,
    range_low: 70,
    range_high: 100,
    source: 'seeded',
    source_url: null,
    verified_at: null,
    verified_by: null,
    range_type: 'normal',
    phase: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeProposed(overrides: Partial<ParsedMayoRange> = {}): ParsedMayoRange {
  return {
    component: 'Glucose',
    unit: 'mg/dL',
    range_low: 74,
    range_high: 106,
    sex: 'general',
    ...overrides,
  }
}

describe('computeRangeDiff', () => {
  it('produces diff items with rangeId for matching current ranges', () => {
    const current: ReferenceRange[] = [
      makeRange({ id: 'r-1', unit: 'mg/dL', sex: 'general' }),
      makeRange({ id: 'r-2', unit: 'mg/dL', sex: 'male', range_low: 80, range_high: 110 }),
    ]

    const proposed: ParsedMayoRange[] = [
      makeProposed({ unit: 'mg/dL', sex: 'general', range_low: 74, range_high: 106 }),
      makeProposed({ unit: 'mg/dL', sex: 'male', range_low: 85, range_high: 115 }),
    ]

    const diff = computeRangeDiff(current, proposed)

    expect(diff.length).toBe(2)

    const generalDiff = diff.find((d) => d.proposed.sex === 'general')
    expect(generalDiff).toBeDefined()
    expect(generalDiff!.rangeId).toBe('r-1')
    expect(generalDiff!.current).not.toBeNull()
    expect(generalDiff!.current!.range_low).toBe(70)
    expect(generalDiff!.proposed.range_low).toBe(74)

    const maleDiff = diff.find((d) => d.proposed.sex === 'male')
    expect(maleDiff).toBeDefined()
    expect(maleDiff!.rangeId).toBe('r-2')
    expect(maleDiff!.current!.range_low).toBe(80)
    expect(maleDiff!.proposed.range_low).toBe(85)
  })

  it('produces diff items with rangeId: null for unmatched proposed ranges', () => {
    const current: ReferenceRange[] = [
      makeRange({ id: 'r-1', unit: 'mg/dL', sex: 'general' }),
    ]

    const proposed: ParsedMayoRange[] = [
      makeProposed({ unit: 'mg/dL', sex: 'female', range_low: 65, range_high: 95 }),
    ]

    const diff = computeRangeDiff(current, proposed)

    expect(diff.length).toBe(1)
    expect(diff[0].rangeId).toBeNull()
    expect(diff[0].field).toBe('new')
    expect(diff[0].current).toBeNull()
    expect(diff[0].proposed.sex).toBe('female')
  })

  it('only matches against normal ranges, not optimal', () => {
    const current: ReferenceRange[] = [
      makeRange({
        id: 'r-opt',
        unit: 'mg/dL',
        sex: 'general',
        range_type: 'optimal',
        range_low: 75,
        range_high: 95,
      }),
    ]

    const proposed: ParsedMayoRange[] = [
      makeProposed({ unit: 'mg/dL', sex: 'general' }),
    ]

    const diff = computeRangeDiff(current, proposed)

    expect(diff.length).toBe(1)
    // Should NOT match the optimal range
    expect(diff[0].rangeId).toBeNull()
    expect(diff[0].field).toBe('new')
    expect(diff[0].current).toBeNull()
  })

  it('handles mixed matching and unmatched proposed ranges', () => {
    const current: ReferenceRange[] = [
      makeRange({ id: 'r-1', unit: 'mg/dL', sex: 'general' }),
    ]

    const proposed: ParsedMayoRange[] = [
      makeProposed({ unit: 'mg/dL', sex: 'general', range_low: 74 }),
      makeProposed({ unit: 'mg/dL', sex: 'male', range_low: 80 }),
    ]

    const diff = computeRangeDiff(current, proposed)

    expect(diff.length).toBe(2)

    const matched = diff.find((d) => d.rangeId === 'r-1')
    expect(matched).toBeDefined()
    expect(matched!.proposed.sex).toBe('general')

    const unmatched = diff.find((d) => d.rangeId === null)
    expect(unmatched).toBeDefined()
    expect(unmatched!.proposed.sex).toBe('male')
  })
})
