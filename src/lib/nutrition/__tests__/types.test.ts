import { describe, it, expect } from 'vitest'
import { nutritionExtractionSchema } from '../types'

describe('nutritionExtractionSchema', () => {
  it('accepts a full Claude response', () => {
    const r = nutritionExtractionSchema.safeParse({
      calories: 650, protein_g: 55, carbs_g: 60, fat_g: 20,
      fiber_g: 5, sugar_g: 8, sodium_mg: 400, saturated_fat_g: 4,
      food_name: 'Chicken with rice', notes: 'post workout',
      date_offset_days: 0, meal_time: 'lunch',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.meal_time).toBe('lunch')
  })

  it('coerces missing optional fields to null', () => {
    const r = nutritionExtractionSchema.safeParse({ food_name: 'Apple' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.calories).toBeNull()
      expect(r.data.notes).toBeNull()
      expect(r.data.meal_time).toBeNull()
    }
  })

  it('rejects when food_name is missing', () => {
    expect(nutritionExtractionSchema.safeParse({ calories: 100 }).success).toBe(false)
  })
})
