import { describe, it, expect, vi, afterEach } from 'vitest'

import type { TypedSupabaseClient } from '@/lib/supabase/database'
import { loadLibraryItems } from '../library'

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

function fakeClient(results: Record<string, Result>) {
  const calls: Record<string, Call[]> = {}
  const client = {
    from: vi.fn((table: string) => {
      calls[table] = []
      return fakeQuery(results[table], calls[table])
    }),
  }
  return { client: client as unknown as TypedSupabaseClient, calls }
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

const ok = (data: unknown[]): Result => ({ data, error: null })

afterEach(() => vi.restoreAllMocks())

describe('loadLibraryItems', () => {
  it('filters by user and skips ordering for the service client', async () => {
    const { client, calls } = fakeClient({ custom_foods: ok([]), recipes: ok([]) })
    await loadLibraryItems(client, { userId: 'user-1', logTag: '[t]' })
    const expected: Call[] = [
      ['select', '*'],
      ['eq', 'user_id', 'user-1'],
      ['eq', 'is_deleted', false],
    ]
    expect(calls.custom_foods).toEqual(expected)
    expect(calls.recipes).toEqual(expected)
  })

  it('omits the user filter and orders by name for an RLS client', async () => {
    const { client, calls } = fakeClient({ custom_foods: ok([]), recipes: ok([]) })
    await loadLibraryItems(client, { orderByName: true, logTag: '[t]' })
    const expected: Call[] = [
      ['select', '*'],
      ['eq', 'is_deleted', false],
      ['order', 'name', { ascending: true }],
    ]
    expect(calls.custom_foods).toEqual(expected)
    expect(calls.recipes).toEqual(expected)
  })

  it('maps custom foods first, then recipes, dropping recipes without grams', async () => {
    const { client } = fakeClient({
      custom_foods: ok([customFood]),
      recipes: ok([recipe, { ...recipe, id: 'rec-0', total_grams: 0 }]),
    })
    const items = await loadLibraryItems(client, { userId: 'user-1', logTag: '[t]' })
    expect(items).toEqual([
      {
        kind: 'custom_food',
        id: 'cf-1',
        name: 'Oat Bar',
        default_grams: 50,
        per100g: { kcal: 400, protein: 30, carbs: 40, fat: 10, fiber: 5, sugar: 8, sodium_mg: 200, sat_fat: 3 },
      },
      {
        kind: 'recipe',
        id: 'rec-1',
        name: 'Chili',
        default_grams: 400,
        per100g: { kcal: 200, protein: 10, carbs: 20, fat: 5, fiber: 3, sugar: 4, sodium_mg: 300, sat_fat: 2 },
      },
    ])
  })

  it('logs the first query error under the tag and keeps the other list', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = fakeClient({
      custom_foods: { data: null, error: { message: 'cf boom' } },
      recipes: ok([recipe]),
    })
    const items = await loadLibraryItems(client, { logTag: '[logFood]' })
    expect(spy).toHaveBeenCalledWith('[logFood] library load failed:', 'cf boom')
    expect(items.map((i) => i.id)).toEqual(['rec-1'])
  })

  it('reports the recipes error when only recipes fail', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = fakeClient({
      custom_foods: ok([customFood]),
      recipes: { data: null, error: { message: 'rec boom' } },
    })
    const items = await loadLibraryItems(client, { logTag: '[x]' })
    expect(spy).toHaveBeenCalledWith('[x] library load failed:', 'rec boom')
    expect(items.map((i) => i.id)).toEqual(['cf-1'])
  })

  it('does not log when both queries succeed', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = fakeClient({ custom_foods: ok([]), recipes: ok([]) })
    expect(await loadLibraryItems(client, { logTag: '[x]' })).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })

  it('lets a thrown error propagate (callers decide whether to swallow it)', async () => {
    const client = {
      from: () => {
        throw new Error('network down')
      },
    } as unknown as TypedSupabaseClient
    await expect(loadLibraryItems(client, { logTag: '[x]' })).rejects.toThrow('network down')
  })
})
