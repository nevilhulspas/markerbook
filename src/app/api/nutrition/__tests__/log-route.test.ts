import { describe, it, expect, vi, beforeEach } from 'vitest'
// The per-user AI limit has its own tests (src/lib/ai/__tests__/quota.test.ts).
vi.mock('@/lib/ai/quota', () => ({
  takeAiRequest: async () => ({ ok: true }),
  aiLimitResponse: (error: string) => Response.json({ error }, { status: 429 }),
  AI_LIMIT_REACHED: 'limit',
}))

const { mockResolveUserIdByToken, mockLogSubmission, mockGetUser } = vi.hoisted(() => ({
  mockResolveUserIdByToken: vi.fn(),
  mockLogSubmission: vi.fn(),
  mockGetUser: vi.fn(),
}))

vi.mock('@/lib/nutrition/log-token', () => ({
  resolveUserIdByToken: mockResolveUserIdByToken,
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}))
vi.mock('@/lib/nutrition/log-core', async (orig) => {
  const actual = (await orig()) as object
  return { ...actual, logSubmission: mockLogSubmission }
})
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    })),
    rpc: vi.fn(async () => ({ data: [], error: null })),
  },
}))
vi.mock('@/lib/nutrition/off', () => ({ searchOff: vi.fn(async () => []) }))

import { POST } from '../log/route'

beforeEach(() => {
  vi.clearAllMocks()
  mockResolveUserIdByToken.mockImplementation(async (token: string | null) =>
    token === 'tok-1' ? 'user-1' : null
  )
  mockGetUser.mockResolvedValue({ data: { user: null } })
})

function makeRequest(body: unknown, token?: string): Request {
  return new Request('http://localhost/api/nutrition/log', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/nutrition/log', () => {
  it('returns 401 without a token', async () => {
    const res = await POST(makeRequest({ food: 'x' }))
    expect(res.status).toBe(401)
    expect(mockLogSubmission).not.toHaveBeenCalled()
  })

  it('returns 401 with an invalid token', async () => {
    const res = await POST(makeRequest({ food: 'x' }, 'wrong-token'))
    expect(res.status).toBe(401)
    expect(mockLogSubmission).not.toHaveBeenCalled()
  })

  it('returns 401 with an invalid token even when a session exists', async () => {
    // An explicit (bad) token must not silently fall back to cookie auth.
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const res = await POST(makeRequest({ food: 'x' }, 'wrong-token'))
    expect(res.status).toBe(401)
    expect(mockLogSubmission).not.toHaveBeenCalled()
  })

  it('accepts a logged-in session without a token (native Log Food intent)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    // Auth passed — fails later on body validation, not with 401.
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns the question when allow_question is set and the parser asks one', async () => {
    mockLogSubmission.mockResolvedValue({ kind: 'question', question: 'How much rice?' })
    const res = await POST(makeRequest({ food: 'rice', allow_question: true }, 'tok-1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ question: 'How much rice?' })
    expect(mockLogSubmission).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ text: 'rice', assumeDefaults: false })
    )
  })

  it('appends the clarification and assumes defaults on the second round', async () => {
    mockLogSubmission.mockResolvedValue({ kind: 'question', question: 'ignored' })
    await POST(makeRequest({ food: 'rice', clarification: '200 grams', allow_question: true }, 'tok-1'))
    expect(mockLogSubmission).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        text: 'rice\nClarification: 200 grams',
        assumeDefaults: true,
      })
    )
  })

  it('still assumes defaults without allow_question (legacy iPhone Shortcut)', async () => {
    mockLogSubmission.mockResolvedValue({ kind: 'question', question: 'unexpected' })
    const res = await POST(makeRequest({ food: 'rice' }, 'tok-1'))
    // assumeDefaults stays true, so a question outcome is a server error.
    expect(res.status).toBe(500)
    expect(mockLogSubmission).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ assumeDefaults: true })
    )
  })

  it('returns 400 when food is missing', async () => {
    const res = await POST(makeRequest({}, 'tok-1'))
    expect(res.status).toBe(400)
    expect(mockLogSubmission).not.toHaveBeenCalled()
  })

  it('returns the caltrack-compatible aggregate shape with match_summary', async () => {
    mockLogSubmission.mockResolvedValue({
      kind: 'logged',
      submissionId: 'sub-1',
      foodName: 'breakfast plate',
      notes: null,
      mealType: 'breakfast',
      items: [
        { name: 'Oats', grams: 60, matchSource: 'nevo' },
        { name: 'My Granola', grams: 30, matchSource: 'custom_food' },
        { name: 'Mystery sauce', grams: 20, matchSource: 'estimate' },
      ],
      totals: {
        kcal: 500,
        protein: 20,
        carbs: 60,
        fat: 15,
        fiber: 8,
        sugar: 12,
        sodium_mg: 300,
        sat_fat: 4,
      },
    })

    const res = await POST(makeRequest({ food: 'oats with granola and sauce' }, 'tok-1'))
    expect(res.status).toBe(200)

    const json = (await res.json()) as Record<string, unknown>

    // The 8 Apple Health / caltrack macro keys
    expect(json).toMatchObject({
      calories: 500,
      protein_g: 20,
      carbs_g: 60,
      fat_g: 15,
      fiber_g: 8,
      sugar_g: 12,
      sodium_mg: 300,
      saturated_fat_g: 4,
      food_name: 'breakfast plate',
    })

    expect(json.items).toHaveLength(3)
    expect(json.match_summary).toEqual({ matched: 1, library: 1, estimated: 1 })
  })
})

describe('POST /api/nutrition/log library load', () => {
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
  const logged = {
    kind: 'logged',
    submissionId: 'sub-1',
    foodName: 'x',
    notes: null,
    mealType: 'lunch',
    items: [],
    totals: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium_mg: 0, sat_fat: 0 },
  }

  async function mockedFrom() {
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    return vi.mocked(supabaseAdmin.from) as unknown as ReturnType<typeof vi.fn>
  }

  it("loads the token user's custom foods + recipes (no ordering) into the library", async () => {
    const from = await mockedFrom()
    const calls: Record<string, Call[]> = {}
    const results: Record<string, Result> = {
      custom_foods: { data: [customFood], error: null },
      recipes: { data: [recipe, { ...recipe, id: 'rec-0', total_grams: 0 }], error: null },
    }
    from.mockImplementation((table: string) => {
      calls[table] = []
      return fakeQuery(results[table], calls[table])
    })
    mockLogSubmission.mockResolvedValue(logged)

    const res = await POST(makeRequest({ food: 'oat bar' }, 'tok-1'))
    expect(res.status).toBe(200)

    const expected: Call[] = [
      ['select', '*'],
      ['eq', 'user_id', 'user-1'],
      ['eq', 'is_deleted', false],
    ]
    expect(calls.custom_foods).toEqual(expected)
    expect(calls.recipes).toEqual(expected)
    const deps = mockLogSubmission.mock.calls[0][0] as { library: { kind: string; id: string }[] }
    expect(deps.library.map((i) => [i.kind, i.id])).toEqual([
      ['custom_food', 'cf-1'],
      ['recipe', 'rec-1'],
    ])
  })

  it('logs a query error and still logs the meal', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const from = await mockedFrom()
    from.mockImplementation((table: string) =>
      fakeQuery(
        table === 'recipes'
          ? { data: null, error: { message: 'boom' } }
          : { data: [customFood], error: null },
        []
      )
    )
    mockLogSubmission.mockResolvedValue(logged)

    const res = await POST(makeRequest({ food: 'oat bar' }, 'tok-1'))
    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledWith('[log route] library load failed:', 'boom')
    const deps = mockLogSubmission.mock.calls[0][0] as { library: { id: string }[] }
    expect(deps.library.map((i) => i.id)).toEqual(['cf-1'])
    spy.mockRestore()
  })

  it('swallows a thrown library load and logs with an empty library', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const from = await mockedFrom()
    const err = new Error('network down')
    from.mockImplementation(() => {
      throw err
    })
    mockLogSubmission.mockResolvedValue(logged)

    const res = await POST(makeRequest({ food: 'oat bar' }, 'tok-1'))
    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledWith('[log route] Library load failed:', err)
    const deps = mockLogSubmission.mock.calls[0][0] as { library: unknown[] }
    expect(deps.library).toEqual([])
    spy.mockRestore()
  })

  it('accepts the token as a ?token= query parameter', async () => {
    const from = await mockedFrom()
    from.mockImplementation(() => fakeQuery({ data: [], error: null }, []))
    mockLogSubmission.mockResolvedValue(logged)

    const req = new Request('http://localhost/api/nutrition/log?token=tok-1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ food: 'oat bar' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockLogSubmission).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'user-1', source: 'shortcut' })
    )
  })
})
