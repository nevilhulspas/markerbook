import { describe, it, expect } from 'vitest'

import { lbsToGrams, gramsToKg, kgToGrams, trendDelta, deriveFfmi } from '../metrics'

describe('unit conversions', () => {
  it('converts lbs to grams', () => {
    expect(lbsToGrams(10)).toBeCloseTo(4535.92, 1)
  })
  it('converts grams to kg and back', () => {
    expect(gramsToKg(61698)).toBeCloseTo(61.698, 3)
    expect(kgToGrams(61.698)).toBeCloseTo(61698, 0)
  })
})

describe('trendDelta', () => {
  it('returns absolute + percent change vs previous', () => {
    const d = trendDelta(26.2, 28.0)
    expect(d.abs).toBeCloseTo(-1.8, 5)
    expect(d.pct).toBeCloseTo(-6.43, 1)
  })
  it('is null-safe for missing values', () => {
    expect(trendDelta(26.2, null)).toEqual({ abs: null, pct: null })
    expect(trendDelta(null, 28)).toEqual({ abs: null, pct: null })
  })
  it('avoids divide-by-zero', () => {
    expect(trendDelta(5, 0)).toEqual({ abs: 5, pct: null })
  })
})

describe('deriveFfmi', () => {
  it('computes FFMI from lean+bmc grams and height cm', () => {
    // (61698 + 2588)/1000 kg / 1.76^2 ≈ 20.76
    expect(deriveFfmi(61698, 2588, 176)).toBeCloseTo(20.76, 1)
  })
  it('treats missing bmc as 0', () => {
    expect(deriveFfmi(61698, null, 176)).toBeCloseTo(19.92, 1)
  })
  it('returns null without lean or height', () => {
    expect(deriveFfmi(null, 2588, 176)).toBeNull()
    expect(deriveFfmi(61698, 2588, null)).toBeNull()
  })
})
