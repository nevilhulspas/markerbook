import { describe, it, expect } from 'vitest'
import { photoLogBodySchema } from '../nutrition'

const item = {
  query: 'rice', grams: 150, weightEstimated: true,
  per100: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sugar: 0.1, sodium_mg: 1, sat_fat: 0.1 },
  matchSource: 'nevo', matchRef: 'N9', recipeId: null, customFoodId: null,
}

describe('photoLogBodySchema', () => {
  it('accepts a valid body', () => {
    const out = photoLogBodySchema.parse({ food_name: 'Rice bowl', notes: null, meal: 'lunch', date: null, items: [item] })
    expect(out.items[0].grams).toBe(150)
  })
  it('rejects non-positive grams', () => {
    expect(() => photoLogBodySchema.parse({ food_name: 'x', items: [{ ...item, grams: 0 }] })).toThrow()
  })
  it('rejects an empty item list', () => {
    expect(() => photoLogBodySchema.parse({ food_name: 'x', items: [] })).toThrow()
  })
})
