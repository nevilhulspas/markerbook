import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockResolve, mockLog, mockUpload, mockInsert, mockRemove } = vi.hoisted(() => ({
  mockResolve: vi.fn(), mockLog: vi.fn(), mockUpload: vi.fn(), mockInsert: vi.fn(), mockRemove: vi.fn(),
}))
vi.mock('@/lib/nutrition/log-token', () => ({ resolveUserIdByToken: mockResolve }))
vi.mock('@/lib/nutrition/log-core', async (orig) => {
  const actual = (await orig()) as object
  return { ...actual, logConfirmedItems: mockLog }
})
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }))
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    storage: { from: () => ({ upload: mockUpload, remove: mockRemove }) },
    from: () => ({ insert: mockInsert }),
  },
}))

import { POST } from '../log/route'

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0x00])

const payload = {
  food_name: 'Rice bowl', notes: null, meal: 'lunch', date: null,
  items: [{ query: 'rice', grams: 150, weightEstimated: true,
    per100: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sugar: 0.1, sodium_mg: 1, sat_fat: 0.1 },
    matchSource: 'nevo', matchRef: 'N9', recipeId: null, customFoodId: null }],
}

function reqWith(payloadObj: unknown): Request {
  const fd = new FormData()
  fd.set('image', new File([JPEG], 'm.jpg', { type: 'image/jpeg' }))
  fd.set('payload', JSON.stringify(payloadObj))
  return new Request('http://x/api/nutrition/photo/log', { method: 'POST', headers: { authorization: 'Bearer t' }, body: fd })
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/nutrition/photo/log', () => {
  it('uploads the photo, logs items, and returns the summary', async () => {
    mockResolve.mockResolvedValue('u1')
    mockUpload.mockResolvedValue({ data: { path: 'u1/x.jpg' }, error: null })
    mockLog.mockResolvedValue({
      submissionId: 's1', foodName: 'Rice bowl', mealType: 'lunch', imagePath: 'u1/x.jpg',
      items: [{ name: 'rice', grams: 150, matchSource: 'nevo' }],
      totals: { kcal: 195, protein: 4, carbs: 42, fat: 0.5, fiber: 0.6, sugar: 0.2, sodium_mg: 2, sat_fat: 0.2 },
    })
    const res = await POST(reqWith(payload))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.food_name).toBe('Rice bowl')
    expect(body.calories).toBeCloseTo(195)
    expect(body.match_summary).toEqual({ matched: 1, library: 0, estimated: 0 })
    expect(mockUpload).toHaveBeenCalledOnce()
  })

  it('400 on an invalid payload', async () => {
    mockResolve.mockResolvedValue('u1')
    const res = await POST(reqWith({ food_name: 'x', items: [] }))
    expect(res.status).toBe(400)
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('removes the uploaded photo when logConfirmedItems rejects', async () => {
    mockResolve.mockResolvedValue('u1')
    mockUpload.mockResolvedValue({ data: { path: 'u1/x.jpg' }, error: null })
    mockRemove.mockResolvedValue({ data: null, error: null })
    mockLog.mockRejectedValue(new Error('db error'))
    const res = await POST(reqWith(payload))
    expect(res.status).toBe(500)
    expect(mockRemove).toHaveBeenCalledOnce()
    const [paths] = mockRemove.mock.calls[0] as [string[]]
    expect(paths).toHaveLength(1)
    expect(paths[0]).toMatch(/^u1\//)
  })
})
