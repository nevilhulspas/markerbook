import { describe, it, expect } from 'vitest'
import { manualFoodLogSchema, nutritionTargetsSchema } from '../nutrition'

describe('manualFoodLogSchema', () => {
  it('requires a food name and date', () => {
    expect(manualFoodLogSchema.safeParse({ entry_date: '', food_name: '' }).success).toBe(false)
  })
  it('accepts a minimal valid entry', () => {
    const r = manualFoodLogSchema.safeParse({ entry_date: '2026-06-08', food_name: 'Apple' })
    expect(r.success).toBe(true)
  })
  it('rejects negative calories', () => {
    expect(
      manualFoodLogSchema.safeParse({ entry_date: '2026-06-08', food_name: 'Apple', calories: -5 }).success
    ).toBe(false)
  })
  it('accepts a positive grams value', () => {
    const r = manualFoodLogSchema.safeParse({ entry_date: '2026-06-08', food_name: 'Apple', grams: 150 })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.grams).toBe(150)
  })
  it('grams is optional and nullable', () => {
    expect(manualFoodLogSchema.safeParse({ entry_date: '2026-06-08', food_name: 'Apple' }).success).toBe(true)
    expect(
      manualFoodLogSchema.safeParse({ entry_date: '2026-06-08', food_name: 'Apple', grams: null }).success
    ).toBe(true)
  })
  it('rejects non-positive grams', () => {
    expect(
      manualFoodLogSchema.safeParse({ entry_date: '2026-06-08', food_name: 'Apple', grams: 0 }).success
    ).toBe(false)
    expect(
      manualFoodLogSchema.safeParse({ entry_date: '2026-06-08', food_name: 'Apple', grams: -10 }).success
    ).toBe(false)
  })
})

describe('nutritionTargetsSchema', () => {
  it('accepts nullable integer targets', () => {
    expect(nutritionTargetsSchema.safeParse({ calories: 2200, protein_g: null }).success).toBe(true)
  })
  it('accepts macros that add up to the calorie goal', () => {
    // 190*4 + 294*4 + 85*9 = 2701 kcal vs a 2700 goal — well within 5%
    expect(
      nutritionTargetsSchema.safeParse({ calories: 2700, protein_g: 190, carbs_g: 294, fat_g: 85 })
        .success
    ).toBe(true)
  })
  it('rejects macros more than 5% off the calorie goal', () => {
    // 300*4 + 300*4 + 100*9 = 3300 kcal vs a 2700 goal
    expect(
      nutritionTargetsSchema.safeParse({ calories: 2700, protein_g: 300, carbs_g: 300, fat_g: 100 })
        .success
    ).toBe(false)
  })
  it('skips the consistency check when a value is missing', () => {
    expect(nutritionTargetsSchema.safeParse({ calories: 2700, protein_g: 190 }).success).toBe(true)
    expect(
      nutritionTargetsSchema.safeParse({ protein_g: 300, carbs_g: 300, fat_g: 100 }).success
    ).toBe(true)
  })
  it('rejects partial macros that already exceed the calorie goal', () => {
    // 473*4 + 405*4 = 3512 kcal vs a 2700 goal, fat unset
    expect(
      nutritionTargetsSchema.safeParse({ calories: 2700, protein_g: 473, carbs_g: 405 }).success
    ).toBe(false)
  })
})
