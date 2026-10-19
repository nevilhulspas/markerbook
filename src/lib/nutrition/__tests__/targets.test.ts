import { describe, it, expect } from 'vitest'
import { ageFromDob, suggestTargetsFromProfile } from '../targets'

describe('ageFromDob', () => {
  it('computes age, accounting for birthday not yet reached', () => {
    expect(ageFromDob('1990-12-31', new Date('2026-06-08'))).toBe(35)
    expect(ageFromDob('1990-01-01', new Date('2026-06-08'))).toBe(36)
    expect(ageFromDob(null)).toBeNull()
  })
})

describe('suggestTargetsFromProfile', () => {
  it('returns rounded calorie + protein targets for a complete profile', () => {
    const r = suggestTargetsFromProfile(
      { sex: 'male', height_cm: 180, weight_kg: 80, activity_level: 'moderate', date_of_birth: '1990-01-01' },
      new Date('2026-06-08')
    )
    // BMR = 10*80 + 6.25*180 - 5*36 + 5 = 1750; *1.55 = 2712.5 -> 2700 (nearest 100)
    expect(r).toEqual({ calories: 2700, protein_g: 128 })
  })

  it('returns null when data is insufficient', () => {
    expect(suggestTargetsFromProfile({ sex: 'male', height_cm: null, weight_kg: 80, activity_level: 'moderate', date_of_birth: '1990-01-01' })).toBeNull()
    expect(suggestTargetsFromProfile(null)).toBeNull()
  })
})
