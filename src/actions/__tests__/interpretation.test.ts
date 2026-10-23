import { describe, it, expect, vi, beforeEach } from 'vitest'

const { adminFrom, ownTests } = vi.hoisted(() => ({ adminFrom: vi.fn(), ownTests: [] as string[] }))

vi.mock('@/lib/supabase/session', () => ({
  getSessionUser: async () => ({
    user: { id: 'user-1' },
    supabase: {
      from: () => {
        let id: unknown
        const b = {
          select: () => b,
          eq: (col: string, val: unknown) => {
            if (col === 'id') id = val
            return b
          },
          maybeSingle: async () => ({ data: ownTests.includes(id as string) ? { id } : null, error: null }),
        }
        return b
      },
    },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: { from: adminFrom } }))

import { saveInterpretation } from '../interpretation'

const params = {
  bloodTestId: 'bt-1',
  type: 'full_test' as const,
  content: 'ok',
  profileHash: 'p',
  markerContextHash: 'm',
  model: 'x',
}

describe('saveInterpretation', () => {
  beforeEach(() => {
    adminFrom.mockReset()
    ownTests.length = 0
  })

  it("refuses to attach an interpretation to another user's test", async () => {
    expect(await saveInterpretation(params)).toEqual({ success: false, error: 'Test not found' })
    expect(adminFrom).not.toHaveBeenCalled()
  })

  it('refuses an unknown type or oversized content', async () => {
    ownTests.push('bt-1')
    expect((await saveInterpretation({ ...params, type: 'novel' as never })).success).toBe(false)
    expect((await saveInterpretation({ ...params, content: 'x'.repeat(100_001) })).success).toBe(false)
    expect(adminFrom).not.toHaveBeenCalled()
  })
})
