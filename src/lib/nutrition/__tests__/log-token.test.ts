import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockMaybeSingle, mockEq, mockFrom } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn()
  const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom = vi.fn(() => ({ select: mockSelect }))
  return { mockMaybeSingle, mockEq, mockSelect, mockFrom }
})
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: { from: mockFrom } }))

import { resolveUserIdByToken } from '../log-token'

beforeEach(() => vi.clearAllMocks())

describe('resolveUserIdByToken', () => {
  it('returns null for a missing token without querying', async () => {
    expect(await resolveUserIdByToken(null)).toBeNull()
    expect(mockFrom).not.toHaveBeenCalled()
  })
  it('returns the user id for a known token', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'user-9' }, error: null })
    expect(await resolveUserIdByToken('tok-abc')).toBe('user-9')
    expect(mockEq).toHaveBeenCalledWith('nutrition_log_token', 'tok-abc')
  })
  it('returns null for an unknown token', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await resolveUserIdByToken('nope')).toBeNull()
  })
  it('returns null on a DB error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'db error' } })
    expect(await resolveUserIdByToken('tok')).toBeNull()
  })
})
