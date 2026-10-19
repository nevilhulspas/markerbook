import { describe, it, expect } from 'vitest'
import { photoExtractionSchema, buildPhotoExtractPrompt } from '../photo-parse'

describe('photoExtractionSchema', () => {
  it('parses a normal multi-item food photo', () => {
    const parsed = photoExtractionSchema.parse({
      items: [
        { query: 'grilled chicken breast', grams: 140, estimated_calories: 230, estimated_protein_g: 43,
          estimated_carbs_g: 0, estimated_fat_g: 5, estimated_fiber_g: 0, estimated_sugar_g: 0,
          estimated_sodium_mg: 100, estimated_saturated_fat_g: 1 },
      ],
      food_name: 'Chicken & rice bowl', notes: null, meal_time: 'lunch', is_food: true, question: null,
    })
    expect(parsed.is_food).toBe(true)
    expect(parsed.items[0].grams).toBe(140)
  })

  it('accepts a not-food result with empty items', () => {
    const parsed = photoExtractionSchema.parse({
      items: [], food_name: 'Not food', notes: null, meal_time: null, is_food: false,
      question: "That doesn't look like food — want to try another photo?",
    })
    expect(parsed.is_food).toBe(false)
    expect(parsed.items).toHaveLength(0)
  })

  it('rejects a result missing is_food', () => {
    expect(() => photoExtractionSchema.parse({ items: [], food_name: 'x', meal_time: null, question: null }))
      .toThrow()
  })
})

describe('buildPhotoExtractPrompt', () => {
  it('embeds library names and a clarification', () => {
    const p = buildPhotoExtractPrompt(['Overnight oats'], 'it is pork, not chicken')
    expect(p).toContain('Overnight oats')
    expect(p).toContain('pork')
  })
})
