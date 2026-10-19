import { vi } from 'vitest'

// Must hoist and mock before any import that touches @anthropic-ai/sdk
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate }
  },
}))

import { describe, it, expect, beforeEach } from 'vitest'
import {
  normalizeName,
  findLibraryMatch,
  libraryItemFromCustomFood,
  libraryItemFromRecipe,
  scaleTo,
  rerankCandidates,
  matchItem,
  type LibraryItem,
  type MatchDeps,
  type Macros100,
} from '../match'
import type { CustomFood, NevoFood, Recipe } from '@/lib/database.types'
import type { OffCandidate } from '../off'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLibraryItem(name: string, overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    kind: 'custom_food',
    id: 'test-id',
    name,
    default_grams: 100,
    per100g: { kcal: 200, protein: 20, carbs: 10, fat: 8, fiber: 1, sugar: 2, sodium_mg: 50, sat_fat: 3 },
    ...overrides,
  }
}

function makeDeps(overrides: Partial<MatchDeps> = {}): MatchDeps {
  return {
    library: [],
    searchNevo: async () => [],
    searchOff: async () => [],
    rerank: rerankCandidates,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// normalizeName
// ---------------------------------------------------------------------------

describe('normalizeName', () => {
  it('lowercases input', () => {
    expect(normalizeName('Chicken Breast')).toBe('chicken breast')
  })

  it('strips diacritics', () => {
    expect(normalizeName('crème fraîche')).toBe('creme fraiche')
    expect(normalizeName('café')).toBe('cafe')
    expect(normalizeName('naïve')).toBe('naive')
  })

  it('replaces punctuation with spaces and collapses whitespace', () => {
    // punctuation → space, then whitespace collapsed and trimmed
    expect(normalizeName('salt & pepper, mix!')).toBe('salt pepper mix')
    const result = normalizeName('double--dash')
    expect(result).not.toContain('--')
  })

  it('trims leading and trailing whitespace', () => {
    expect(normalizeName('  apple  ')).toBe('apple')
  })

  it('handles empty string', () => {
    expect(normalizeName('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// findLibraryMatch — substring pass
// ---------------------------------------------------------------------------

describe('findLibraryMatch — substring', () => {
  const items: LibraryItem[] = [
    makeLibraryItem('Sams protein shake', { id: 'shake' }),
    makeLibraryItem('Banana', { id: 'banana' }),
    makeLibraryItem('Greek yogurt', { id: 'yogurt' }),
  ]

  it('matches when query contains item name (substring hit)', () => {
    const result = findLibraryMatch('184g sams protein shake', items)
    expect(result?.id).toBe('shake')
  })

  it('matches when item name contains query', () => {
    const result = findLibraryMatch('banana', items)
    expect(result?.id).toBe('banana')
  })

  it('returns null when no substring overlap', () => {
    const result = findLibraryMatch('pizza margherita', items)
    expect(result).toBeNull()
  })

  it('returns null for empty library', () => {
    expect(findLibraryMatch('apple', [])).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// findLibraryMatch — Jaccard fallback
// ---------------------------------------------------------------------------

describe('findLibraryMatch — Jaccard fallback', () => {
  it('matches when Jaccard ≥ 0.5 (2 shared out of 4 unique tokens)', () => {
    // query tokens (>2 chars): 'protein', 'shake', 'chocolate'
    // item tokens: 'sams', 'protein', 'shake'
    // intersection: 'protein', 'shake' = 2
    // union: 'protein', 'shake', 'chocolate', 'sams' = 4
    // Jaccard = 2/4 = 0.5 — exactly at threshold
    const items = [makeLibraryItem('Sams protein shake', { id: 'shake' })]
    const result = findLibraryMatch('protein shake chocolate', items)
    expect(result?.id).toBe('shake')
  })

  it('does not match when Jaccard < 0.5', () => {
    // 'banana' vs 'Sams protein shake' — no token overlap
    const items = [makeLibraryItem('Sams protein shake', { id: 'shake' })]
    const result = findLibraryMatch('banana', items)
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// libraryItemFromCustomFood
// ---------------------------------------------------------------------------

describe('libraryItemFromCustomFood', () => {
  it('maps all fields, coercing nulls to 0', () => {
    const food: CustomFood = {
      id: 'cf1',
      user_id: 'u1',
      name: 'Oat Milk',
      brand: 'Oatly',
      kcal_per_100g: 46,
      protein_per_100g: 1,
      carbs_per_100g: 6.6,
      fat_per_100g: 1.5,
      fiber_per_100g: null,
      sugar_per_100g: null,
      sodium_mg_per_100g: null,
      sat_fat_per_100g: null,
      default_grams: 200,
      notes: null,
      is_deleted: false,
      created_at: '',
      updated_at: '',
    }
    const item = libraryItemFromCustomFood(food)
    expect(item.kind).toBe('custom_food')
    expect(item.id).toBe('cf1')
    expect(item.per100g.kcal).toBe(46)
    expect(item.per100g.fiber).toBe(0)
    expect(item.per100g.sodium_mg).toBe(0)
    expect(item.default_grams).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// libraryItemFromRecipe
// ---------------------------------------------------------------------------

describe('libraryItemFromRecipe', () => {
  const baseRecipe: Recipe = {
    id: 'r1',
    user_id: 'u1',
    name: 'Smoothie',
    notes: null,
    total_grams: 400,
    total_kcal: 800,
    total_protein: 40,
    total_carbs: 80,
    total_fat: 20,
    total_fiber: 8,
    total_sugar: 30,
    total_sodium_mg: 200,
    total_sat_fat: 6,
    is_deleted: false,
    created_at: '',
    updated_at: '',
  }

  it('computes per100g correctly: 400g/800kcal → 200kcal per 100g', () => {
    const item = libraryItemFromRecipe(baseRecipe)
    expect(item).not.toBeNull()
    expect(item!.per100g.kcal).toBe(200)           // 800 / 400 * 100
    expect(item!.per100g.protein).toBe(10)          // 40 / 400 * 100
    expect(item!.default_grams).toBe(400)
    expect(item!.kind).toBe('recipe')
  })

  it('returns null when total_grams is 0', () => {
    const item = libraryItemFromRecipe({ ...baseRecipe, total_grams: 0 })
    expect(item).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// scaleTo
// ---------------------------------------------------------------------------

describe('scaleTo', () => {
  it('scales linearly from per-100g to arbitrary grams', () => {
    const per100g: Macros100 = {
      kcal: 200, protein: 20, carbs: 10, fat: 8, fiber: 2, sugar: 4, sodium_mg: 100, sat_fat: 3,
    }
    const scaled = scaleTo(per100g, 150)
    expect(scaled.kcal).toBeCloseTo(300)
    expect(scaled.protein).toBeCloseTo(30)
    expect(scaled.sodium_mg).toBeCloseTo(150)
  })

  it('returns zeros when grams = 0', () => {
    const per100g: Macros100 = {
      kcal: 200, protein: 20, carbs: 10, fat: 8, fiber: 2, sugar: 4, sodium_mg: 100, sat_fat: 3,
    }
    const scaled = scaleTo(per100g, 0)
    expect(scaled.kcal).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// rerankCandidates
// ---------------------------------------------------------------------------

describe('rerankCandidates', () => {
  it('returns the parsed index when model replies with a valid number', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: '1' }] })
    const idx = await rerankCandidates(
      { query: 'chicken breast', grams: 150 },
      [{ label: 'Chicken breast raw' }, { label: 'Chicken breast cooked' }]
    )
    expect(idx).toBe(1)
  })

  it('returns null when model replies "none"', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'none' }] })
    const idx = await rerankCandidates(
      { query: 'pizza', grams: null },
      [{ label: 'Cheese pizza' }]
    )
    expect(idx).toBeNull()
  })

  it('returns null when model replies with garbage text', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'I think number 0 is best' }] })
    const idx = await rerankCandidates(
      { query: 'apple', grams: 100 },
      [{ label: 'Apple raw' }]
    )
    expect(idx).toBeNull()
  })

  it('returns null when index is out of range', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: '5' }] })
    const idx = await rerankCandidates(
      { query: 'egg', grams: 50 },
      [{ label: 'Egg boiled' }, { label: 'Egg fried' }]
    )
    expect(idx).toBeNull()
  })

  it('returns null gracefully on API error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCreate.mockRejectedValueOnce(new Error('API down'))
    const idx = await rerankCandidates(
      { query: 'bread', grams: 40 },
      [{ label: 'White bread' }]
    )
    expect(idx).toBeNull()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('returns null for empty candidates without calling API', async () => {
    const idx = await rerankCandidates({ query: 'water', grams: null }, [])
    expect(mockCreate).not.toHaveBeenCalled()
    expect(idx).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// matchItem
// ---------------------------------------------------------------------------

describe('matchItem', () => {
  const estimated: Macros100 = {
    kcal: 150, protein: 10, carbs: 20, fat: 5, fiber: 1, sugar: 3, sodium_mg: 80, sat_fat: 1,
  }

  it('hits library — uses default_grams when item.grams is null', async () => {
    const libraryItem = makeLibraryItem('Sams protein shake', {
      id: 'shake',
      default_grams: 300,
      per100g: { kcal: 100, protein: 20, carbs: 5, fat: 2, fiber: 0, sugar: 1, sodium_mg: 50, sat_fat: 0 },
    })
    const deps = makeDeps({ library: [libraryItem] })
    // inject a spy to confirm rerank is NOT called
    const rerankSpy = vi.fn()
    deps.rerank = rerankSpy

    const result = await matchItem(
      { query: '200g sams protein shake', grams: null, estimated },
      deps
    )

    expect(result.source).toBe('custom_food')
    expect(result.customFoodId).toBe('shake')
    expect(result.grams).toBe(300) // snapped to default_grams
    expect(rerankSpy).not.toHaveBeenCalled()
  })

  it('hits library — uses item.grams when provided', async () => {
    const libraryItem = makeLibraryItem('Oatmeal', { id: 'oats', default_grams: 200 })
    const deps = makeDeps({ library: [libraryItem] })

    const result = await matchItem(
      { query: 'oatmeal', grams: 150, estimated },
      deps
    )

    expect(result.grams).toBe(150)
  })

  it('picks NEVO result when library misses and rerank selects NEVO candidate', async () => {
    const nevoFood: NevoFood = {
      nevo_code: 'F001',
      name_nl: 'Kipfilet',
      name_en: 'Chicken breast',
      synonyms: null,
      food_group_nl: null,
      food_group_en: null,
      kcal_per_100g: 165,
      protein_per_100g: 31,
      carbs_per_100g: 0,
      fat_per_100g: 3.6,
      fiber_per_100g: 0,
      sugar_per_100g: 0,
      sodium_mg_per_100g: 74,
      sat_fat_per_100g: 1,
      search_text: 'kipfilet chicken breast',
    }

    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: '0' }] })

    const deps = makeDeps({
      searchNevo: async () => [nevoFood],
      searchOff: async () => [],
      rerank: rerankCandidates,
    })

    const result = await matchItem(
      { query: 'chicken breast', grams: 200, estimated },
      deps
    )

    expect(result.source).toBe('nevo')
    expect(result.ref).toBe('F001')
    expect(result.name).toBe('Kipfilet')
    expect(result.grams).toBe(200)
    expect(result.macros.kcal).toBeCloseTo(330) // 165 * 2
  })

  it('maps rerank index across the NEVO/OFF boundary — index 1 hits the first OFF entry', async () => {
    const nevoFood: NevoFood = {
      nevo_code: 'F100',
      name_nl: 'Pindakaas',
      name_en: 'Peanut butter',
      synonyms: null,
      food_group_nl: null,
      food_group_en: null,
      kcal_per_100g: 600,
      protein_per_100g: 25,
      carbs_per_100g: 12,
      fat_per_100g: 50,
      fiber_per_100g: 6,
      sugar_per_100g: 5,
      sodium_mg_per_100g: 400,
      sat_fat_per_100g: 9,
      search_text: 'pindakaas peanut butter',
    }
    const offCandidate: OffCandidate = {
      barcode: '9988776655',
      name: 'Pindakaas — Calvé',
      per100g: {
        kcal: 620, protein: 24, carbs: 13, fat: 52, fiber: 5, sugar: 6, sodium_mg: 420, sat_fat: 10,
      },
    }

    // Candidate list is NEVO first then OFF, so index 1 = the first OFF entry
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: '1' }] })

    const deps = makeDeps({
      searchNevo: async () => [nevoFood],
      searchOff: async () => [offCandidate],
      rerank: rerankCandidates,
    })

    const result = await matchItem(
      { query: 'calve pindakaas', grams: 30, estimated },
      deps
    )

    expect(result.source).toBe('off')
    expect(result.ref).toBe('9988776655')
    expect(result.name).toBe('Pindakaas — Calvé')
    expect(result.macros.kcal).toBeCloseTo(186) // 620 * 0.3
  })

  it('picks OFF result when library misses and rerank selects OFF candidate', async () => {
    const offCandidate: OffCandidate = {
      barcode: '1234567890',
      name: 'Chocomel — FrieslandCampina',
      per100g: {
        kcal: 80, protein: 3, carbs: 14, fat: 1.5, fiber: 0, sugar: 13, sodium_mg: 60, sat_fat: 1,
      },
    }

    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: '0' }] })

    const deps = makeDeps({
      searchNevo: async () => [],
      searchOff: async () => [offCandidate],
      rerank: rerankCandidates,
    })

    const result = await matchItem(
      { query: 'chocomel', grams: 250, estimated },
      deps
    )

    expect(result.source).toBe('off')
    expect(result.ref).toBe('1234567890')
    expect(result.name).toBe('Chocomel — FrieslandCampina')
    expect(result.macros.kcal).toBeCloseTo(200) // 80 * 2.5
  })

  it('falls back to estimate when no candidates found', async () => {
    const deps = makeDeps({
      searchNevo: async () => [],
      searchOff: async () => [],
    })

    const result = await matchItem(
      { query: 'mystery soup', grams: 300, estimated },
      deps
    )

    expect(result.source).toBe('estimate')
    expect(result.name).toBe('mystery soup')
    expect(result.grams).toBe(300)
    expect(result.macros).toEqual(estimated)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('falls back to estimate when rerank returns null', async () => {
    const nevoFood: NevoFood = {
      nevo_code: 'F999',
      name_nl: 'Vreemd gerecht',
      name_en: null,
      synonyms: null,
      food_group_nl: null,
      food_group_en: null,
      kcal_per_100g: 200,
      protein_per_100g: 5,
      carbs_per_100g: 30,
      fat_per_100g: 5,
      fiber_per_100g: 0,
      sugar_per_100g: 0,
      sodium_mg_per_100g: 0,
      sat_fat_per_100g: 0,
      search_text: '',
    }

    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'none' }] })

    const deps = makeDeps({
      searchNevo: async () => [nevoFood],
      searchOff: async () => [],
      rerank: rerankCandidates,
    })

    const result = await matchItem(
      { query: 'unmatched food', grams: null, estimated },
      deps
    )

    expect(result.source).toBe('estimate')
    expect(result.grams).toBe(0) // item.grams ?? 0
  })

  it('sets recipeId when library hit is a recipe', async () => {
    const recipeItem = makeLibraryItem('Protein Smoothie', { id: 'r1', kind: 'recipe' })
    const deps = makeDeps({ library: [recipeItem] })

    const result = await matchItem(
      { query: 'protein smoothie', grams: 400, estimated },
      deps
    )

    expect(result.source).toBe('recipe')
    expect(result.recipeId).toBe('r1')
    expect(result.customFoodId).toBeNull()
  })
})
