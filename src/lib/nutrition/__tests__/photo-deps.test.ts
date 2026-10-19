import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: { from: mockFrom, rpc: vi.fn() } }))
vi.mock('../off', () => ({ searchOff: vi.fn(async () => []) }))

import { buildPhotoMatchDeps } from '../photo-deps'

type Call = [string, ...unknown[]]
type Result = { data: unknown[] | null; error: { message: string } | null }

/** Chainable, awaitable stand-in for a Supabase query that records its calls. */
function fakeQuery(result: Result, calls: Call[]) {
  const q = {
    select: (...a: unknown[]) => (calls.push(['select', ...a]), q),
    eq: (...a: unknown[]) => (calls.push(['eq', ...a]), q),
    order: (...a: unknown[]) => (calls.push(['order', ...a]), q),
    then: <T>(resolve: (r: Result) => T, reject?: (e: unknown) => T) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return q
}

const customFood = {
  id: 'cf-1',
  name: 'Oat Bar',
  default_grams: 50,
  kcal_per_100g: 400,
  protein_per_100g: 30,
  carbs_per_100g: 40,
  fat_per_100g: 10,
  fiber_per_100g: 5,
  sugar_per_100g: 8,
  sodium_mg_per_100g: 200,
  sat_fat_per_100g: 3,
}
const recipe = {
  id: 'rec-1',
  name: 'Chili',
  total_grams: 400,
  total_kcal: 800,
  total_protein: 40,
  total_carbs: 80,
  total_fat: 20,
  total_fiber: 12,
  total_sugar: 16,
  total_sodium_mg: 1200,
  total_sat_fat: 8,
}
const emptyRecipe = { ...recipe, id: 'rec-0', total_grams: 0 }

let calls: Record<string, Call[]>

function serve(results: Record<string, Result>) {
  calls = {}
  mockFrom.mockImplementation((table: string) => {
    calls[table] = []
    return fakeQuery(results[table], calls[table])
  })
}

beforeEach(() => vi.clearAllMocks())

describe('buildPhotoMatchDeps library', () => {
  it('loads both lists for the user (no ordering) and maps them to library items', async () => {
    serve({
      custom_foods: { data: [customFood], error: null },
      recipes: { data: [recipe, emptyRecipe], error: null },
    })
    const deps = await buildPhotoMatchDeps('user-1')

    const expected: Call[] = [
      ['select', '*'],
      ['eq', 'user_id', 'user-1'],
      ['eq', 'is_deleted', false],
    ]
    expect(calls.custom_foods).toEqual(expected)
    expect(calls.recipes).toEqual(expected)
    // Custom foods first; a recipe without total grams is dropped.
    expect(deps.library.map((i) => [i.kind, i.id])).toEqual([
      ['custom_food', 'cf-1'],
      ['recipe', 'rec-1'],
    ])
    expect(deps.library[1].per100g.kcal).toBeCloseTo(200, 5)
  })

  it('logs a query error and keeps the other list', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    serve({
      custom_foods: { data: null, error: { message: 'boom' } },
      recipes: { data: [recipe], error: null },
    })
    const deps = await buildPhotoMatchDeps('user-1')
    expect(spy).toHaveBeenCalledWith('[photo-deps] library load failed:', 'boom')
    expect(deps.library.map((i) => i.id)).toEqual(['rec-1'])
    spy.mockRestore()
  })

  it('swallows a thrown load and falls back to an empty library', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('network down')
    mockFrom.mockImplementation(() => {
      throw err
    })
    const deps = await buildPhotoMatchDeps('user-1')
    expect(spy).toHaveBeenCalledWith('[photo-deps] library load failed:', err)
    expect(deps.library).toEqual([])
    spy.mockRestore()
  })
})
