import { describe, it, expect, vi } from 'vitest'

const { mockSessionUser } = vi.hoisted(() => ({ mockSessionUser: vi.fn() }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/session', () => ({ getSessionUser: mockSessionUser }))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: {} }))

import { getProfile } from '../profile'

describe('getProfile', () => {
  it('never returns the Shortcut token, which would end up in the page HTML', async () => {
    const row = { id: 'u1', display_name: 'Alex', nutrition_log_token: 'secret-token' }
    const chain = {
      select: () => chain,
      eq: () => chain,
      single: () => Promise.resolve({ data: row, error: null }),
    }
    mockSessionUser.mockResolvedValue({ supabase: { from: () => chain }, user: { id: 'u1' }, authError: null })

    const res = await getProfile()
    expect(res.error).toBeNull()
    expect(res.data).toEqual({ id: 'u1', display_name: 'Alex' })
    expect(JSON.stringify(res)).not.toContain('secret-token')
  })
})
