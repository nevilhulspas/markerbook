import { describe, it, expect, vi, beforeEach } from 'vitest'
// The per-user AI limit has its own tests (src/lib/ai/__tests__/quota.test.ts).
vi.mock('@/lib/ai/quota', () => ({
  takeAiRequest: async () => ({ ok: true }),
  aiLimitResponse: (error: string) => Response.json({ error }, { status: 429 }),
  AI_LIMIT_REACHED: 'limit',
}))

const { mockResolve, mockAnalyze, mockBuildDeps } = vi.hoisted(() => ({
  mockResolve: vi.fn(), mockAnalyze: vi.fn(), mockBuildDeps: vi.fn(),
}))
vi.mock('@/lib/nutrition/log-token', () => ({ resolveUserIdByToken: mockResolve }))
vi.mock('@/lib/nutrition/photo-analyze', () => ({ analyzePhoto: mockAnalyze }))
vi.mock('@/lib/nutrition/photo-deps', () => ({ buildPhotoMatchDeps: mockBuildDeps, MAX_PHOTO_BYTES: 10 * 1024 * 1024 }))
vi.mock('@/lib/nutrition/photo-parse', () => ({ parsePhotoBytes: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }))

import { POST } from '../analyze/route'

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0x00])

function req(form: FormData, token = 'tok'): Request {
  return new Request('http://x/api/nutrition/photo/analyze', {
    method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form,
  })
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/nutrition/photo/analyze', () => {
  it('401 without a resolvable user', async () => {
    mockResolve.mockResolvedValue(null)
    const fd = new FormData(); fd.set('image', new File([JPEG], 'm.jpg', { type: 'image/jpeg' }))
    const res = await POST(req(fd))
    expect(res.status).toBe(401)
  })

  it('400 when the image bytes are not a recognized type', async () => {
    mockResolve.mockResolvedValue('u1')
    const fd = new FormData(); fd.set('image', new File([new Uint8Array([1, 2, 3])], 'x.bin'))
    const res = await POST(req(fd))
    expect(res.status).toBe(400)
  })

  it('returns the analysis JSON on success', async () => {
    mockResolve.mockResolvedValue('u1')
    mockBuildDeps.mockResolvedValue({ library: [] })
    mockAnalyze.mockResolvedValue({ food_name: 'Bowl', meal_time: 'lunch', is_food: true, question: null, items: [] })
    const fd = new FormData(); fd.set('image', new File([JPEG], 'm.jpg', { type: 'image/jpeg' }))
    const res = await POST(req(fd))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ food_name: 'Bowl', is_food: true })
  })

  it('413 when the uploaded image exceeds 10 MB', async () => {
    mockResolve.mockResolvedValue('u1')
    const bigBytes = new Uint8Array(11 * 1024 * 1024)
    const file = new File([bigBytes], 'm.jpg', { type: 'image/jpeg' })
    const fd = new FormData(); fd.set('image', file)
    const res = await POST(req(fd))
    expect(res.status).toBe(413)
  })
})
