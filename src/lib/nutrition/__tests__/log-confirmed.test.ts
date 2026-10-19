import { describe, it, expect } from 'vitest'
import { logConfirmedItems, type ConfirmedItem, type FoodLogInsertRow } from '../log-core'
import type { Macros100 } from '../macros'

const per100: Macros100 = {
  kcal: 100, protein: 10, carbs: 5, fat: 2, fiber: 1, sugar: 1, sodium_mg: 50, sat_fat: 0.5,
}

function item(over: Partial<ConfirmedItem> = {}): ConfirmedItem {
  return {
    query: 'grilled chicken', grams: 200, per100, weightEstimated: false,
    matchSource: 'nevo', matchRef: 'NEVO123', recipeId: null, customFoodId: null, ...over,
  }
}

describe('logConfirmedItems', () => {
  it('scales per-item macros, sets photo fields, and returns totals', async () => {
    let captured: FoodLogInsertRow[] = []
    const res = await logConfirmedItems(
      {
        insertRows: async (rows) => { captured = rows; return { error: null } },
        now: () => new Date('2026-06-30T13:00:00'),
      },
      {
        userId: 'u1', source: 'photo', foodName: 'Chicken bowl', notes: null,
        mealOverride: 'lunch', dateOverride: null, imagePath: 'u1/abc.jpg',
        items: [item(), item({ query: 'rice', grams: 150, weightEstimated: true, matchSource: 'estimate', matchRef: null })],
      },
    )

    expect(captured).toHaveLength(2)
    expect(captured[0].calories).toBeCloseTo(200) // 100 kcal/100g * 200g
    expect(captured[0].source).toBe('photo')
    expect(captured[0].image_path).toBe('u1/abc.jpg')
    expect(captured[0].weight_estimated).toBe(false)
    expect(captured[1].weight_estimated).toBe(true)
    expect(captured[0].submission_id).toBe(captured[1].submission_id) // shared
    expect(res.totals.kcal).toBeCloseTo(350) // 200 + 150
    expect(res.mealType).toBe('lunch')
    expect(res.items.map((i) => i.name)).toEqual(['grilled chicken', 'rice'])
  })

  it('throws when insertRows reports an error', async () => {
    await expect(
      logConfirmedItems(
        { insertRows: async () => ({ error: 'db down' }) },
        { userId: 'u1', source: 'photo', foodName: 'x', notes: null, mealOverride: 'snack', dateOverride: null, imagePath: null, items: [item()] },
      ),
    ).rejects.toThrow('db down')
  })
})
