import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUser, mockRevalidatePath, mockSearchOff, fromImpl } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockSearchOff: vi.fn(),
  fromImpl: { current: vi.fn() },
}))

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: fromImpl.current,
    rpc: vi.fn(async () => ({ data: [], error: null })),
  })),
}))
vi.mock('@/lib/nutrition/off', () => ({ searchOff: mockSearchOff }))

import { saveCustomFood, deleteCustomFood, saveRecipe, deleteRecipe, getRecipeSummary, getRecipeLogStats } from '../nutrition-library'
import type { CustomFoodInput, RecipeInput } from '@/lib/validations/nutrition'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  mockSearchOff.mockResolvedValue([])
})

// ---------------------------------------------------------------------------
// saveCustomFood
// ---------------------------------------------------------------------------

describe('saveCustomFood', () => {
  it('rejects missing name', async () => {
    const r = await saveCustomFood({
      name: '',
      default_grams: 100,
    } as CustomFoodInput)
    expect(r.error).toBeTruthy()
    expect(r.error).toMatch(/Name is required/i)
  })

  it('rejects negative per-100g values', async () => {
    const r = await saveCustomFood({
      name: 'Bad food',
      kcal_per_100g: -10,
      default_grams: 100,
    } as unknown as CustomFoodInput)
    expect(r.error).toBeTruthy()
  })

  it('rejects non-positive default_grams', async () => {
    const r = await saveCustomFood({
      name: 'Bad food',
      default_grams: 0,
    } as CustomFoodInput)
    expect(r.error).toBeTruthy()
  })

  it('inserts and returns id on success', async () => {
    fromImpl.current = vi.fn(() => ({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'cf-123' }, error: null }),
        }),
      }),
    }))

    const r = await saveCustomFood({
      name: 'Oat Milk',
      kcal_per_100g: 46,
      protein_per_100g: 1,
      default_grams: 200,
    } as CustomFoodInput)
    expect(r.error).toBeNull()
    expect(r.id).toBe('cf-123')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/nutrition/library')
  })

  it('updates when id is provided', async () => {
    const existingId = '550e8400-e29b-41d4-a716-446655440000'
    const updateSpy = vi.fn(() => ({
      eq: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: existingId }, error: null }),
        }),
      }),
    }))
    fromImpl.current = vi.fn(() => ({ update: updateSpy }))

    const r = await saveCustomFood({
      id: existingId,
      name: 'Updated Oat Milk',
      default_grams: 250,
    } as CustomFoodInput)
    expect(r.error).toBeNull()
    expect(updateSpy).toHaveBeenCalled()
  })

  it('requires authentication', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const r = await saveCustomFood({ name: 'Test', default_grams: 100 } as CustomFoodInput)
    expect(r.error).toBe('You must be signed in.')
  })
})

// ---------------------------------------------------------------------------
// deleteCustomFood
// ---------------------------------------------------------------------------

describe('deleteCustomFood', () => {
  it('soft-deletes the food', async () => {
    const updateSpy = vi.fn(() => ({
      eq: () => Promise.resolve({ error: null }),
    }))
    fromImpl.current = vi.fn(() => ({ update: updateSpy }))

    const r = await deleteCustomFood('cf-123')
    expect(r.error).toBeNull()
    expect(updateSpy).toHaveBeenCalledWith({ is_deleted: true })
  })
})

// ---------------------------------------------------------------------------
// saveRecipe — totals math
// ---------------------------------------------------------------------------

describe('saveRecipe', () => {
  it('rejects missing recipe name', async () => {
    const r = await saveRecipe({
      name: '',
      ingredients: [{ raw_name: 'Egg', grams: 50, kcal_per_100g: 150 }],
    } as RecipeInput)
    expect(r.error).toMatch(/Name is required/i)
  })

  it('rejects recipe with no ingredients', async () => {
    const r = await saveRecipe({ name: 'Empty', ingredients: [] } as unknown as RecipeInput)
    expect(r.error).toBeTruthy()
  })

  it('computes totals correctly from ingredients', async () => {
    // Two ingredients:
    //  - 100g @ 100 kcal/100g = 100 kcal
    //  - 200g @ 200 kcal/100g = 400 kcal
    //  Total: 300g, 500 kcal

    let capturedRecipeRow: Record<string, unknown> | null = null
    const insertRecipeSpy = vi.fn((row: Record<string, unknown>) => {
      capturedRecipeRow = row
      return {
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'r-1' }, error: null }),
        }),
      }
    })
    const insertIngredientsSpy = vi.fn(() => Promise.resolve({ error: null }))

    fromImpl.current = vi.fn((table: string) => {
      if (table === 'recipes') return { insert: insertRecipeSpy }
      if (table === 'recipe_ingredients') return { insert: insertIngredientsSpy }
      return {}
    })

    const r = await saveRecipe({
      name: 'Test Recipe',
      ingredients: [
        {
          raw_name: 'Ingredient A',
          grams: 100,
          kcal_per_100g: 100,
          protein_per_100g: 10,
          carbs_per_100g: 15,
          fat_per_100g: 3,
          fiber_per_100g: 2,
          sugar_per_100g: 5,
          sodium_mg_per_100g: 100,
          sat_fat_per_100g: 1,
        },
        {
          raw_name: 'Ingredient B',
          grams: 200,
          kcal_per_100g: 200,
          protein_per_100g: 20,
          carbs_per_100g: 30,
          fat_per_100g: 6,
          fiber_per_100g: 4,
          sugar_per_100g: 10,
          sodium_mg_per_100g: 200,
          sat_fat_per_100g: 2,
        },
      ],
    } as RecipeInput)

    expect(r.error).toBeNull()
    expect(capturedRecipeRow).not.toBeNull()

    // total_grams = 100 + 200 = 300
    expect(capturedRecipeRow!.total_grams).toBe(300)
    // total_kcal = (100*100/100) + (200*200/100) = 100 + 400 = 500
    expect(capturedRecipeRow!.total_kcal).toBe(500)
    // total_protein = (10*100/100) + (20*200/100) = 10 + 40 = 50
    expect(capturedRecipeRow!.total_protein).toBe(50)
  })

  it('requires at least one ingredient with a name', async () => {
    // Missing both raw_name and all refs
    const r = await saveRecipe({
      name: 'No-name recipe',
      ingredients: [{ grams: 100, kcal_per_100g: 100 }] as unknown as RecipeInput['ingredients'],
    } as RecipeInput)
    expect(r.error).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// deleteRecipe
// ---------------------------------------------------------------------------

describe('deleteRecipe', () => {
  it('soft-deletes the recipe', async () => {
    const updateSpy = vi.fn(() => ({
      eq: () => Promise.resolve({ error: null }),
    }))
    fromImpl.current = vi.fn(() => ({ update: updateSpy }))

    const r = await deleteRecipe('r-123')
    expect(r.error).toBeNull()
    expect(updateSpy).toHaveBeenCalledWith({ is_deleted: true })
  })
})

// ---------------------------------------------------------------------------
// getRecipeSummary
// ---------------------------------------------------------------------------

describe('getRecipeSummary', () => {
  it('returns id/name/total_grams when recipe is found', async () => {
    fromImpl.current = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: { id: 'r-abc', name: 'Chicken Rice', total_grams: 450 },
                error: null,
              }),
          }),
        }),
      }),
    }))

    const result = await getRecipeSummary('r-abc')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('r-abc')
    expect(result!.name).toBe('Chicken Rice')
    expect(result!.total_grams).toBe(450)
  })

  it('returns null when recipe is not found', async () => {
    fromImpl.current = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    }))

    const result = await getRecipeSummary('nonexistent-id')
    expect(result).toBeNull()
  })

  it('rejects on a DB error (distinguishable from not-found)', async () => {
    fromImpl.current = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: { message: 'db error' } }),
          }),
        }),
      }),
    }))

    await expect(getRecipeSummary('r-abc')).rejects.toThrow('db error')
  })
})

// ---------------------------------------------------------------------------
// getRecipeLogStats
// ---------------------------------------------------------------------------

describe('getRecipeLogStats', () => {
  it('returns count and YYYY-MM-DD earliest date from the query result', async () => {
    fromImpl.current = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: [{ entry_date: '2026-06-09T05:00:00+00:00' }],
                    count: 5,
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      }),
    }))

    const result = await getRecipeLogStats('r1')
    expect(result.count).toBe(5)
    expect(result.earliestDate).toBe('2026-06-09')
  })

  it('throws when the query returns an error', async () => {
    fromImpl.current = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: null,
                    count: null,
                    error: { message: 'query failed' },
                  }),
              }),
            }),
          }),
        }),
      }),
    }))

    await expect(getRecipeLogStats('r1')).rejects.toThrow('query failed')
  })
})
