import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const generateLink = vi.fn()
const getUserById = vi.fn()
const maybeSingle = vi.fn()
const verifyOtp = vi.fn()
const getUser = vi.fn()
const cookieGet = vi.fn()
const cookieSet = vi.fn()
const cookieDelete = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    auth: { admin: { generateLink: (...a: unknown[]) => generateLink(...a), getUserById: (...a: unknown[]) => getUserById(...a) } },
    from: () => ({ select: () => ({ eq: () => ({ is: () => ({ maybeSingle: () => maybeSingle() }) }) }) }),
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { verifyOtp: (...a: unknown[]) => verifyOtp(...a), getUser: () => getUser() } }),
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: cookieGet, set: cookieSet, delete: cookieDelete }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('mintSessionFor', () => {
  it('generates a magiclink then verifies the token hash', async () => {
    generateLink.mockResolvedValue({ data: { properties: { hashed_token: 'tok-123' } }, error: null })
    verifyOtp.mockResolvedValue({ error: null })
    const { mintSessionFor } = await import('../impersonation')
    const res = await mintSessionFor('user@test.com')
    expect(res).toEqual({ ok: true })
    expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'user@test.com' })
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'tok-123', type: 'email' })
  })
  it('returns an error when generateLink fails', async () => {
    generateLink.mockResolvedValue({ data: null, error: { message: 'nope' } })
    const { mintSessionFor } = await import('../impersonation')
    const res = await mintSessionFor('user@test.com')
    expect(res.ok).toBe(false)
    expect(verifyOtp).not.toHaveBeenCalled()
  })
})

describe('getActiveImpersonation', () => {
  it('returns null when no cookie', async () => {
    cookieGet.mockReturnValue(undefined)
    const { getActiveImpersonation } = await import('../impersonation')
    expect(await getActiveImpersonation()).toBeNull()
  })
  it('returns null when the session user is not the row target', async () => {
    cookieGet.mockReturnValue({ value: 'row-1' })
    maybeSingle.mockResolvedValue({ data: { id: 'row-1', admin_user_id: 'a', target_user_id: 't', ended_at: null } })
    getUser.mockResolvedValue({ data: { user: { id: 'someone-else' } } })
    const { getActiveImpersonation } = await import('../impersonation')
    expect(await getActiveImpersonation()).toBeNull()
  })
  it('resolves the active impersonation when the session is the target', async () => {
    cookieGet.mockReturnValue({ value: 'row-1' })
    maybeSingle.mockResolvedValue({ data: { id: 'row-1', admin_user_id: 'a', target_user_id: 't', ended_at: null } })
    getUser.mockResolvedValue({ data: { user: { id: 't' } } })
    getUserById.mockResolvedValue({ data: { user: { email: 'target@test.com' } } })
    const { getActiveImpersonation } = await import('../impersonation')
    expect(await getActiveImpersonation()).toEqual({
      rowId: 'row-1', adminId: 'a', targetId: 't', targetEmail: 'target@test.com',
    })
  })
})
