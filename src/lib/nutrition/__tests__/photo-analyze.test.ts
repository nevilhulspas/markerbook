import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockMatchItem } = vi.hoisted(() => ({ mockMatchItem: vi.fn() }))
vi.mock('../match', async (orig) => {
  const actual = (await orig()) as object
  return { ...actual, matchItem: mockMatchItem }
})

import { analyzePhoto, type AnalyzePhotoDeps } from '../photo-analyze'
import type { PhotoExtraction } from '../photo-parse'

function deps(parsePhoto: AnalyzePhotoDeps['parsePhoto']): AnalyzePhotoDeps {
  return { library: [], searchNevo: async () => [], searchOff: async () => [], rerank: async () => null, parsePhoto }
}

beforeEach(() => {
  vi.clearAllMocks()
})

const baseExt: PhotoExtraction = {
  items: [{ query: 'chicken', grams: 200, estimated_calories: 330, estimated_protein_g: 62, estimated_carbs_g: 0,
    estimated_fat_g: 7, estimated_fiber_g: 0, estimated_sugar_g: 0, estimated_sodium_mg: 140, estimated_saturated_fat_g: 2 }],
  food_name: 'Chicken', notes: null, meal_time: 'dinner', is_food: true, question: null,
}

describe('analyzePhoto', () => {
  it('returns matched items with recovered per100', async () => {
    mockMatchItem.mockResolvedValue({
      source: 'nevo', ref: 'N1', recipeId: null, customFoodId: null, name: 'chicken breast',
      grams: 200, macros: { kcal: 330, protein: 62, carbs: 0, fat: 7, fiber: 0, sugar: 0, sodium_mg: 140, sat_fat: 2 },
    })
    const out = await analyzePhoto(deps(async () => baseExt), {})
    expect(out.is_food).toBe(true)
    expect(out.items).toHaveLength(1)
    expect(out.items[0].grams).toBe(200)
    expect(out.items[0].per100.kcal).toBeCloseTo(165) // 330 over 200g
    expect(out.items[0].match_source).toBe('nevo')
  })

  it('short-circuits when not food (no matching)', async () => {
    const out = await analyzePhoto(deps(async () => ({ ...baseExt, is_food: false, items: [], question: 'Not food?' })), {})
    expect(out.is_food).toBe(false)
    expect(out.items).toHaveLength(0)
    expect(mockMatchItem).not.toHaveBeenCalled()
  })

  it('short-circuits to ask a question before matching', async () => {
    const out = await analyzePhoto(deps(async () => ({ ...baseExt, question: 'Chicken or pork?' })), {})
    expect(out.question).toBe('Chicken or pork?')
    expect(out.items).toHaveLength(0)
  })

  it('floors a null vision weight to a positive value before matching', async () => {
    const seenGrams: (number | null)[] = []
    mockMatchItem.mockImplementation((item: { query: string; grams: number | null }) => {
      seenGrams.push(item.grams)
      return Promise.resolve({
        source: 'estimate', ref: null, recipeId: null, customFoodId: null,
        name: item.query, grams: item.grams ?? 0,
        macros: { kcal: 200, protein: 10, carbs: 20, fat: 8, fiber: 2, sugar: 5, sodium_mg: 100, sat_fat: 2 },
      })
    })
    const ext = { ...baseExt, items: [{ ...baseExt.items[0], grams: null }] }
    const out = await analyzePhoto(deps(async () => ext), {})
    expect(seenGrams[0]).toBeGreaterThan(0)      // matchItem received a positive grams (the clamp)
    expect(out.items[0].grams).toBeGreaterThan(0) // logged grams stays positive
  })
})
