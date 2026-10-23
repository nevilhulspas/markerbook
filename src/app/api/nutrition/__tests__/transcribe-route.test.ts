import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// The per-user AI limit has its own tests (src/lib/ai/__tests__/quota.test.ts).
vi.mock('@/lib/ai/quota', () => ({
  takeAiRequest: async () => ({ ok: true }),
  countedAiCall: (_userId: string, fn: unknown) => fn,
  aiLimitResponse: (error: string) => Response.json({ error }, { status: 429 }),
  AI_LIMIT_REACHED: 'limit',
}))

const { mockResolveUserIdByToken, mockGetUser } = vi.hoisted(() => ({
  mockResolveUserIdByToken: vi.fn(),
  mockGetUser: vi.fn(),
}))

vi.mock('@/lib/nutrition/log-token', () => ({
  resolveUserIdByToken: mockResolveUserIdByToken,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}))

import { POST } from '../transcribe/route'

const ORIGINAL_KEY = process.env.OPENAI_API_KEY

beforeEach(() => {
  vi.clearAllMocks()
  mockResolveUserIdByToken.mockImplementation(async (token: string | null) =>
    token === 'tok-1' ? 'user-1' : null
  )
  mockGetUser.mockResolvedValue({ data: { user: null } })
})

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = ORIGINAL_KEY
})

describe('POST /api/nutrition/transcribe', () => {
  it('returns 401 without a token or session', async () => {
    const res = await POST(
      new Request('http://localhost/api/nutrition/transcribe', { method: 'POST' })
    )
    expect(res.status).toBe(401)
  })

  it('returns 401 with an invalid token even when a session exists', async () => {
    // An explicit (bad) token must not silently fall back to cookie auth.
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const res = await POST(
      new Request('http://localhost/api/nutrition/transcribe', {
        method: 'POST',
        headers: { authorization: 'Bearer wrong' },
      })
    )
    expect(res.status).toBe(401)
  })

  it('ignores a token in the URL (it would end up in logs)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(
      new Request('http://localhost/api/nutrition/transcribe?token=tok-1', { method: 'POST' })
    )
    expect(res.status).toBe(401)
  })

  it('refuses an upload larger than 25 MB before reading it', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    process.env.OPENAI_API_KEY = 'sk-test'
    const res = await POST(
      new Request('http://localhost/api/nutrition/transcribe', {
        method: 'POST',
        headers: { 'content-length': String(30 * 1024 * 1024) },
      })
    )
    expect(res.status).toBe(413)
  })

  it('accepts a logged-in session without a token (in-app recorder)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    delete process.env.OPENAI_API_KEY
    const res = await POST(
      new Request('http://localhost/api/nutrition/transcribe', { method: 'POST' })
    )
    // Auth passed — fails later on the missing OpenAI key, not with 401.
    expect(res.status).toBe(503)
  })

  it('returns 503 when OPENAI_API_KEY is not configured', async () => {
    delete process.env.OPENAI_API_KEY
    const res = await POST(
      new Request('http://localhost/api/nutrition/transcribe', {
        method: 'POST',
        headers: { authorization: 'Bearer tok-1' },
      })
    )
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'Transcription not configured' })
  })
})
