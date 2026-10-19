import { describe, it, expect } from 'vitest'

import { ACTIVITY_MULTIPLIER, tdee, fatLossRange, leanGainRange } from '@/lib/rmr/tdee'

describe('tdee', () => {
  it('reproduces the DexaFit table for RMR 2229', () => {
    expect(tdee(2229, 'sedentary')).toBe(2675)
    expect(tdee(2229, 'light')).toBe(3065)
    expect(tdee(2229, 'moderate')).toBe(3455)
    expect(tdee(2229, 'active')).toBe(3845)
    expect(tdee(2229, 'very_active')).toBe(4235)
  })

  it('derives fat-loss and lean-gain ranges', () => {
    expect(fatLossRange(3455)).toEqual([2455, 2955])
    expect(leanGainRange(3455)).toEqual([3705, 3955])
  })

  it('exposes all five multipliers', () => {
    expect(Object.keys(ACTIVITY_MULTIPLIER)).toHaveLength(5)
  })
})
