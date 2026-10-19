import { describe, it, expect } from 'vitest'
import { toFoodLogInsert } from '../insert'
import type { NutritionExtraction } from '../types'

const nutrition: NutritionExtraction = {
  calories: 650, protein_g: 55, carbs_g: 60, fat_g: 20,
  fiber_g: 5, sugar_g: 8, sodium_mg: 400, saturated_fat_g: 4,
  food_name: 'Chicken with rice', notes: 'post workout',
  date_offset_days: 0, meal_time: 'lunch',
}

describe('toFoodLogInsert', () => {
  it('maps meal_time -> meal_type and sets source/user', () => {
    const row = toFoodLogInsert({
      userId: 'user-1',
      nutrition,
      entryDate: new Date('2026-06-08T12:30:00Z'),
      rawInput: '200g chicken with rice',
      source: 'app',
    })
    expect(row).toMatchObject({
      user_id: 'user-1',
      food_name: 'Chicken with rice',
      meal_type: 'lunch',
      source: 'app',
      is_deleted: false,
      raw_input: '200g chicken with rice',
      entry_date: '2026-06-08T12:30:00.000Z',
      saturated_fat_g: 4,
    })
  })
})
