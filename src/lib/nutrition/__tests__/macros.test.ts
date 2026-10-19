import { describe, it, expect } from 'vitest'
import { scaleTo, per100From, type Macros100 } from '../macros'

const sample: Macros100 = {
  kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0, sodium_mg: 74, sat_fat: 1,
}

describe('per100From', () => {
  it('inverts scaleTo for positive grams', () => {
    const scaled = scaleTo(sample, 250)
    const recovered = per100From(scaled, 250)
    for (const k of Object.keys(sample) as (keyof Macros100)[]) {
      expect(recovered[k]).toBeCloseTo(sample[k], 6)
    }
  })

  it('returns a copy unchanged when grams is 0', () => {
    const out = per100From(sample, 0)
    expect(out).toEqual(sample)
    expect(out).not.toBe(sample)
  })
})
