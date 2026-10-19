import { describe, it, expect, vi, beforeEach } from 'vitest'
// The per-user AI limit has its own tests (src/lib/ai/__tests__/quota.test.ts).
vi.mock('@/lib/ai/quota', () => ({
  takeAiRequest: async () => ({ ok: true }),
  aiLimitResponse: (error: string) => Response.json({ error }, { status: 429 }),
  AI_LIMIT_REACHED: 'limit',
}))

const { mockGetUser, mockRevalidatePath } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

let insertError: unknown = null
let testInserts: Array<Record<string, unknown>> = []

function reset() {
  insertError = null
  testInserts = []
}

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table !== 'rmr_tests') throw new Error(`unexpected table ${table}`)
      return {
        insert: (data: Record<string, unknown>) => {
          testInserts.push(data)
          return {
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: insertError ? null : { id: 'rmr-1' },
                  error: insertError,
                }),
            }),
          }
        },
      }
    }),
  })),
}))
// extractRmrReport uses these; stub so importing the module doesn't construct
// real clients at import time.
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: { storage: { from: vi.fn() } } }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: vi.fn() }
  },
}))

import { saveRmrTest } from '../rmr-import'

const validExtraction = {
  test: {
    test_date: '2026-05-27',
    provider: 'Dexafit Sofia',
    rmr_kcal: 2229,
    predicted_rmr_kcal: 1887,
    rer: 0.99,
    fuel_carb_pct: 97,
    fuel_fat_pct: 3,
  },
}

describe('saveRmrTest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reset()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('requires authentication', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const r = await saveRmrTest({ extraction: validExtraction })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/authenticated/i)
    expect(testInserts).toHaveLength(0)
  })

  it('inserts the test and returns its id on the happy path', async () => {
    const r = await saveRmrTest({ extraction: validExtraction, storagePath: 'u/rmr/x.pdf' })
    expect(r).toEqual({ success: true, testId: 'rmr-1' })
    expect(testInserts).toHaveLength(1)
    expect(testInserts[0]).toMatchObject({
      user_id: 'user-1',
      test_date: '2026-05-27',
      rmr_kcal: 2229,
      predicted_rmr_kcal: 1887,
      source: 'import',
      pdf_storage_path: 'u/rmr/x.pdf',
    })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/body')
  })

  it('honors an explicit source (e.g. summary from chat "log it")', async () => {
    await saveRmrTest({ extraction: validExtraction, source: 'summary' })
    expect(testInserts[0].source).toBe('summary')
  })

  it('returns the db error and does not revalidate when the insert fails', async () => {
    insertError = { message: 'insert failed' }
    const r = await saveRmrTest({ extraction: validExtraction })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('insert failed')
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('rejects an invalid payload before any DB call', async () => {
    const r = await saveRmrTest({
      extraction: { test: { test_date: '' } } as never,
    })
    expect(r.success).toBe(false)
    expect(testInserts).toHaveLength(0)
  })
})
