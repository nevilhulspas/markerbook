import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Signing up or in must never grant the admin role: with e-mail confirmation
// off, anyone can register with the admin's address and is "confirmed" at
// once. The role is only set by `npm run make-admin`.

const { updateUserById, refreshSession, authClient } = vi.hoisted(() => {
  const updateUserById = vi.fn()
  const refreshSession = vi.fn()
  const adminLookalike = {
    data: {
      user: {
        id: 'attacker',
        email: 'owner@example.com',
        email_confirmed_at: '2026-10-23T10:00:00Z',
        app_metadata: { provider: 'email' },
      },
      session: {},
    },
    error: null,
  }
  return {
    updateUserById,
    refreshSession,
    authClient: {
      auth: {
        signUp: vi.fn(async () => adminLookalike),
        signInWithPassword: vi.fn(async () => adminLookalike),
        exchangeCodeForSession: vi.fn(async () => adminLookalike),
        refreshSession,
      },
    },
  }
})

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => authClient) }))
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { auth: { admin: { updateUserById } } },
}))

import { login, register } from '../auth'
import { GET as authCallback } from '@/app/auth/callback/route'

describe('no admin role on sign-up or sign-in', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_EMAIL', 'owner@example.com')
    updateUserById.mockReset()
    refreshSession.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('register with the ADMIN_EMAIL address', async () => {
    await register({ email: 'owner@example.com', password: 'a-long-password-1', confirmPassword: 'a-long-password-1' })
    expect(authClient.auth.signUp).toHaveBeenCalled()
    expect(updateUserById).not.toHaveBeenCalled()
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('password sign-in with the ADMIN_EMAIL address', async () => {
    await login({ email: 'owner@example.com', password: 'a-long-password-1' })
    expect(authClient.auth.signInWithPassword).toHaveBeenCalled()
    expect(updateUserById).not.toHaveBeenCalled()
  })

  it('OAuth callback for the ADMIN_EMAIL address', async () => {
    const res = await authCallback(new Request('https://app.example/auth/callback?code=abc'))
    expect(authClient.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc')
    expect(res.status).toBe(307)
    expect(updateUserById).not.toHaveBeenCalled()
  })
})
