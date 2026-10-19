import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { User } from '@supabase/supabase-js'

vi.mock('server-only', () => ({}))
const updateUserById = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { auth: { admin: { updateUserById: (...a: unknown[]) => updateUserById(...a) } } },
}))

import { adminEmails, promoteIfAdminEmail } from '@/lib/auth/admin-email'

const user = (over: Partial<User> = {}) =>
  ({
    id: 'u1',
    email: 'Owner@Example.com',
    email_confirmed_at: '2026-10-19T10:00:00Z',
    app_metadata: { provider: 'email' },
    ...over,
  }) as User

describe('promoteIfAdminEmail', () => {
  beforeEach(() => {
    updateUserById.mockReset().mockResolvedValue({ error: null })
    vi.stubEnv('ADMIN_EMAIL', 'owner@example.com, second@example.com')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('reads a comma-separated, case-insensitive list', () => {
    expect(adminEmails()).toEqual(['owner@example.com', 'second@example.com'])
  })

  it('makes a confirmed listed address admin, keeping other app metadata', async () => {
    expect(await promoteIfAdminEmail(user())).toBe(true)
    expect(updateUserById).toHaveBeenCalledWith('u1', { app_metadata: { provider: 'email', role: 'admin' } })
  })

  it('ignores an unconfirmed address', async () => {
    expect(await promoteIfAdminEmail(user({ email_confirmed_at: undefined }))).toBe(false)
    expect(updateUserById).not.toHaveBeenCalled()
  })

  it('ignores an address that is not listed, and an existing admin', async () => {
    expect(await promoteIfAdminEmail(user({ email: 'someone@example.com' }))).toBe(false)
    expect(await promoteIfAdminEmail(user({ app_metadata: { role: 'admin' } }))).toBe(false)
    expect(updateUserById).not.toHaveBeenCalled()
  })

  it('does nothing without ADMIN_EMAIL', async () => {
    vi.stubEnv('ADMIN_EMAIL', '')
    expect(await promoteIfAdminEmail(user())).toBe(false)
  })
})
