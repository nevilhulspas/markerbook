import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const requireAdmin = vi.fn()
const getActiveImpersonation = vi.fn()
const mintSessionFor = vi.fn()
const setImpersonationCookie = vi.fn()
const clearImpersonationCookie = vi.fn()
const profileMaybeSingle = vi.fn()
const rowSingle = vi.fn()
const deleteEq = vi.fn()
const getUserById = vi.fn()
const getSessionUser = vi.fn()
const profileUpdateEq = vi.fn()
const sessionsEnded = vi.fn()
const signOut = vi.fn()
const profileUpdate = vi.fn((...a: unknown[]) => {
  const patch = a[0] as Record<string, unknown>
  if ('ended_at' in patch) {
    // impersonation_sessions: .eq().is().select()
    return { eq: () => ({ is: () => ({ select: () => sessionsEnded() }) }) }
  }
  return { eq: (...e: unknown[]) => profileUpdateEq(...e) }
})
const redirect = vi.fn((...a: unknown[]) => { void a; throw new Error('REDIRECT') })

vi.mock('next/navigation', () => ({ redirect: (...a: unknown[]) => redirect(...a) }))
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: () => requireAdmin() }))
vi.mock('@/lib/supabase/session', () => ({ getSessionUser: () => getSessionUser() }))
vi.mock('@/lib/auth/impersonation', () => ({
  getActiveImpersonation: () => getActiveImpersonation(),
  mintSessionFor: (...a: unknown[]) => mintSessionFor(...a),
  setImpersonationCookie: (...a: unknown[]) => setImpersonationCookie(...a),
  clearImpersonationCookie: () => clearImpersonationCookie(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    auth: { admin: { getUserById: (...a: unknown[]) => getUserById(...a) } },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => profileMaybeSingle() }) }),
      insert: () => ({ select: () => ({ single: () => rowSingle() }) }),
      delete: () => ({ eq: (...a: unknown[]) => deleteEq(...a) }),
      update: (...a: unknown[]) => profileUpdate(...a),
    }),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue({ id: 'admin-1', email: 'admin@test.com' })
  getActiveImpersonation.mockResolvedValue(null)
  getSessionUser.mockResolvedValue({
    supabase: { auth: { signOut: (...a: unknown[]) => signOut(...a) } },
    user: { id: 'user-1' },
    authError: null,
  })
  profileUpdateEq.mockResolvedValue({ error: null })
  sessionsEnded.mockResolvedValue({ data: [], error: null })
  signOut.mockResolvedValue({ error: null })
})

describe('startImpersonation guards', () => {
  it('rejects a non-flagged target without minting', async () => {
    profileMaybeSingle.mockResolvedValue({ data: { id: 'target-1', impersonatable: false } })
    getUserById.mockResolvedValue({ data: { user: { email: 'u@test.com', app_metadata: { role: 'user' } } } })
    const { startImpersonation } = await import('../impersonation')
    const res = await startImpersonation('target-1')
    expect(res).toEqual({ error: 'This user is not marked impersonatable.' })
    expect(mintSessionFor).not.toHaveBeenCalled()
  })

  it('rejects when already impersonating', async () => {
    getActiveImpersonation.mockResolvedValue({ rowId: 'r', adminId: 'admin-1', targetId: 't', targetEmail: 'x' })
    const { startImpersonation } = await import('../impersonation')
    const res = await startImpersonation('target-1')
    expect(res?.error).toMatch(/already impersonating/i)
  })

  it('deletes the row and errors if the mint fails', async () => {
    profileMaybeSingle.mockResolvedValue({ data: { id: 'target-1', impersonatable: true } })
    getUserById.mockResolvedValue({ data: { user: { email: 'u@test.com', app_metadata: { role: 'user' } } } })
    rowSingle.mockResolvedValue({ data: { id: 'row-9' }, error: null })
    mintSessionFor.mockResolvedValue({ ok: false, error: 'boom' })
    const { startImpersonation } = await import('../impersonation')
    const res = await startImpersonation('target-1')
    expect(deleteEq).toHaveBeenCalledWith('id', 'row-9')
    expect(res?.error).toMatch(/boom/)
    expect(setImpersonationCookie).not.toHaveBeenCalled()
  })

  it('mints + sets cookie + redirects on success', async () => {
    profileMaybeSingle.mockResolvedValue({ data: { id: 'target-1', impersonatable: true } })
    getUserById.mockResolvedValue({ data: { user: { email: 'u@test.com', app_metadata: { role: 'user' } } } })
    rowSingle.mockResolvedValue({ data: { id: 'row-9' }, error: null })
    mintSessionFor.mockResolvedValue({ ok: true })
    const { startImpersonation } = await import('../impersonation')
    await expect(startImpersonation('target-1')).rejects.toThrow('REDIRECT')
    expect(setImpersonationCookie).toHaveBeenCalledWith('row-9')
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })
})

describe('impersonation consent', () => {
  it('an admin cannot turn consent on for someone else', async () => {
    const { setImpersonatable } = await import('../impersonation')
    const { CONSENT_ONLY_BY_USER } = await import('@/lib/auth/impersonation-guards')
    expect(await setImpersonatable('target-1', true)).toEqual({ error: CONSENT_ONLY_BY_USER })
    expect(profileUpdate).not.toHaveBeenCalled()
  })

  it('an admin can withdraw consent', async () => {
    const { setImpersonatable } = await import('../impersonation')
    expect(await setImpersonatable('target-1', false)).toEqual({ error: null })
    expect(profileUpdate).toHaveBeenCalledWith({ impersonatable: false })
    expect(profileUpdateEq).toHaveBeenCalledWith('id', 'target-1')
  })

  it('a user can give consent for their own account', async () => {
    const { setOwnImpersonationConsent } = await import('../impersonation')
    expect(await setOwnImpersonationConsent(true)).toEqual({ error: null })
    expect(profileUpdate).toHaveBeenCalledWith({ impersonatable: true })
    expect(profileUpdateEq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('consent cannot be given while an admin is signed in as the user', async () => {
    getActiveImpersonation.mockResolvedValue({ rowId: 'r', adminId: 'admin-1', targetId: 'user-1', targetEmail: 'x' })
    const { setOwnImpersonationConsent } = await import('../impersonation')
    const res = await setOwnImpersonationConsent(true)
    expect(res.error).toMatch(/while an admin is signed in as you/)
    expect(profileUpdate).not.toHaveBeenCalled()
  })

  it('refuses a signed-out caller', async () => {
    getSessionUser.mockResolvedValue({ user: null, authError: null })
    const { setOwnImpersonationConsent } = await import('../impersonation')
    expect((await setOwnImpersonationConsent(true)).error).toBe('You must be signed in.')
  })

  it('withdrawing consent ends an open admin session and signs out other sessions', async () => {
    sessionsEnded.mockResolvedValue({ data: [{ id: 'row-1' }], error: null })
    const { setOwnImpersonationConsent } = await import('../impersonation')
    expect(await setOwnImpersonationConsent(false)).toEqual({ error: null })
    expect(signOut).toHaveBeenCalledWith({ scope: 'others' })
  })

  it('withdrawing consent with no open session does not sign anything out', async () => {
    const { setOwnImpersonationConsent } = await import('../impersonation')
    expect(await setOwnImpersonationConsent(false)).toEqual({ error: null })
    expect(sessionsEnded).toHaveBeenCalled()
    expect(signOut).not.toHaveBeenCalled()
  })
})
