import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
// The per-user AI limit has its own tests (src/lib/ai/__tests__/quota.test.ts).
vi.mock('@/lib/ai/quota', () => ({
  takeAiRequest: async () => ({ ok: true }),
  countedAiCall: (_userId: string, fn: unknown) => fn,
  aiLimitResponse: (error: string) => Response.json({ error }, { status: 429 }),
  AI_LIMIT_REACHED: 'limit',
}))

const { mockGetUser, mockRevalidatePath, mockLogSubmission, fromImpl } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockLogSubmission: vi.fn(),
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
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: { from: vi.fn() } }))
vi.mock('@/lib/nutrition/log-core', async (orig) => {
  const actual = (await orig()) as object
  return { ...actual, logSubmission: mockLogSubmission }
})
vi.mock('@/lib/nutrition/off', () => ({ searchOff: vi.fn(async () => []) }))

import { logFood, logCustomFood } from '../nutrition-logging'
import { updateFoodLog } from '../nutrition-food-logs'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
})

describe('logFood', () => {
  it('requires authentication', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const r = await logFood('200g chicken')
    expect(r).toEqual({ ok: false, error: 'You must be signed in.' })
    expect(mockLogSubmission).not.toHaveBeenCalled()
  })

  it('says AI is not set up when the server has no Anthropic key', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    try {
      const r = await logFood('200g chicken')
      expect(r).toEqual({ ok: false, error: expect.stringMatching(/not set up/) })
      expect(mockLogSubmission).not.toHaveBeenCalled()
    } finally {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    }
  })

  it('rejects empty input before any work', async () => {
    const r = await logFood('   ')
    expect(r.ok).toBe(false)
    expect(mockLogSubmission).not.toHaveBeenCalled()
  })

  it('handles "undo" with no history (no logSubmission call)', async () => {
    fromImpl.current = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
        }),
      }),
    }))
    const r = await logFood('undo')
    expect(r).toMatchObject({ ok: true, undone: true, message: 'No recent meal to undo.' })
    expect(mockLogSubmission).not.toHaveBeenCalled()
  })

  it('returns logged result with items and totals on happy path', async () => {
    // Mock the custom_foods and recipes queries (getLibraryItems)
    fromImpl.current = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }))

    mockLogSubmission.mockResolvedValue({
      kind: 'logged',
      submissionId: 'sub-1',
      foodName: '200g chicken breast',
      notes: null,
      mealType: 'lunch',
      items: [{ name: 'Chicken Breast', grams: 200, matchSource: 'nevo' }],
      totals: { kcal: 330, protein: 62, carbs: 0, fat: 7, fiber: 0, sugar: 0, sodium_mg: 140, sat_fat: 2 },
    })

    const r = await logFood('200g chicken')
    expect(r.ok).toBe(true)
    if (!r.ok) return

    if ('logged' in r) {
      expect(r.logged.foodName).toBe('200g chicken breast')
      expect(r.logged.items).toHaveLength(1)
      expect(r.logged.items[0].name).toBe('Chicken Breast')
      expect(r.logged.totals.kcal).toBe(330)
    }
    expect(mockRevalidatePath).toHaveBeenCalledWith('/nutrition')
  })

  it('returns question when logSubmission returns question outcome', async () => {
    fromImpl.current = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }))

    mockLogSubmission.mockResolvedValue({
      kind: 'question',
      question: 'Does the 200g include the rice?',
    })

    const r = await logFood('200g chicken with rice')
    expect(r.ok).toBe(true)
    if (r.ok && 'question' in r) {
      expect(r.question).toBe('Does the 200g include the rice?')
    }
    // No revalidatePath on a question
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('returns error when logSubmission throws', async () => {
    fromImpl.current = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }))

    mockLogSubmission.mockRejectedValue(new Error('Database error'))

    const r = await logFood('some food')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toBe('Database error')
    }
  })
})

describe('updateFoodLog', () => {
  function captureUpdatePayload() {
    const captured: { payload?: Record<string, unknown> } = {}
    fromImpl.current = vi.fn(() => ({
      update: (payload: Record<string, unknown>) => {
        captured.payload = payload
        return { eq: () => Promise.resolve({ error: null }) }
      },
    }))
    return captured
  }

  it('includes grams in the update payload when provided as a number', async () => {
    const captured = captureUpdatePayload()
    const r = await updateFoodLog('log-1', { entry_date: '2026-06-08', food_name: 'Apple', grams: 150 })
    expect(r.error).toBeNull()
    expect(captured.payload).toMatchObject({ food_name: 'Apple', grams: 150 })
  })

  it('omits grams from the payload when not provided', async () => {
    const captured = captureUpdatePayload()
    const r = await updateFoodLog('log-1', { entry_date: '2026-06-08', food_name: 'Apple' })
    expect(r.error).toBeNull()
    expect(captured.payload).not.toHaveProperty('grams')
  })

  it('omits grams from the payload when null', async () => {
    const captured = captureUpdatePayload()
    const r = await updateFoodLog('log-1', { entry_date: '2026-06-08', food_name: 'Apple', grams: null })
    expect(r.error).toBeNull()
    expect(captured.payload).not.toHaveProperty('grams')
  })

  it('rejects non-positive grams via the schema', async () => {
    const captured = captureUpdatePayload()
    const r = await updateFoodLog('log-1', { entry_date: '2026-06-08', food_name: 'Apple', grams: 0 })
    expect(r.error).not.toBeNull()
    expect(captured.payload).toBeUndefined()
  })
})

describe('logCustomFood', () => {
  const customFood = {
    id: 'cf-1',
    user_id: 'user-1',
    name: 'Oat Protein Bar',
    brand: null,
    kcal_per_100g: 400,
    protein_per_100g: 30,
    carbs_per_100g: 40,
    fat_per_100g: 10,
    fiber_per_100g: 5,
    sugar_per_100g: 8,
    sodium_mg_per_100g: 200,
    sat_fat_per_100g: 3,
    default_grams: 50,
    notes: null,
    is_deleted: false,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  }

  it('requires authentication', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const r = await logCustomFood('cf-1')
    expect(r).toEqual({ error: 'You must be signed in.' })
  })

  it('returns error when custom food is not found', async () => {
    fromImpl.current = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }))
    const r = await logCustomFood('missing-id')
    expect(r).toEqual({ error: 'Custom food not found.' })
  })

  it('inserts a food_logs row with macros scaled to default_grams', async () => {
    const insertedRows: Record<string, unknown>[] = []

    fromImpl.current = vi.fn((table: string) => {
      if (table === 'custom_foods') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: customFood, error: null }),
                }),
              }),
            }),
          }),
        }
      }
      // food_logs insert
      return {
        insert: (row: Record<string, unknown>) => {
          insertedRows.push(row)
          return Promise.resolve({ error: null })
        },
      }
    })

    const r = await logCustomFood('cf-1', { meal: 'lunch' })
    expect(r.error).toBeNull()
    expect(mockRevalidatePath).toHaveBeenCalledWith('/nutrition')

    expect(insertedRows).toHaveLength(1)
    const row = insertedRows[0]
    // Macros should be scaled: 50g / 100 * per100g values
    expect(row).toMatchObject({
      custom_food_id: 'cf-1',
      food_name: 'Oat Protein Bar',
      grams: 50,
      match_source: 'custom_food',
      source: 'app',
      is_deleted: false,
    })
    // 400 kcal/100g * 50/100 = 200 kcal
    expect((row as { calories: number }).calories).toBeCloseTo(200, 5)
    // 30g protein/100g * 50/100 = 15g
    expect((row as { protein_g: number }).protein_g).toBeCloseTo(15, 5)
  })
})

describe('logFood library load', () => {
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

  const customFood = { id: 'cf-1', name: 'Oat Bar', default_grams: 50, kcal_per_100g: 400 }
  const recipe = { id: 'rec-1', name: 'Chili', total_grams: 400, total_kcal: 800 }

  beforeEach(() => {
    mockLogSubmission.mockResolvedValue({ kind: 'question', question: 'How much?' })
  })

  it('loads the RLS-scoped library ordered by name (no user_id filter)', async () => {
    const calls: Record<string, Call[]> = {}
    const results: Record<string, Result> = {
      custom_foods: { data: [customFood], error: null },
      recipes: { data: [recipe, { ...recipe, id: 'rec-0', total_grams: 0 }], error: null },
    }
    fromImpl.current = vi.fn((table: string) => {
      calls[table] = []
      return fakeQuery(results[table], calls[table])
    })

    await logFood('oat bar')

    const expected: Call[] = [
      ['select', '*'],
      ['eq', 'is_deleted', false],
      ['order', 'name', { ascending: true }],
    ]
    expect(calls.custom_foods).toEqual(expected)
    expect(calls.recipes).toEqual(expected)
    const deps = mockLogSubmission.mock.calls[0][0] as { library: { kind: string; id: string }[] }
    expect(deps.library.map((i) => [i.kind, i.id])).toEqual([
      ['custom_food', 'cf-1'],
      ['recipe', 'rec-1'],
    ])
  })

  it('logs a library query error and still logs the meal', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fromImpl.current = vi.fn((table: string) =>
      fakeQuery(
        table === 'custom_foods'
          ? { data: null, error: { message: 'boom' } }
          : { data: [recipe], error: null },
        []
      )
    )

    const r = await logFood('oat bar')
    expect(r).toEqual({ ok: true, question: 'How much?' })
    expect(spy).toHaveBeenCalledWith('[logFood] library load failed:', 'boom')
    const deps = mockLogSubmission.mock.calls[0][0] as { library: { id: string }[] }
    expect(deps.library.map((i) => i.id)).toEqual(['rec-1'])
    spy.mockRestore()
  })
})
