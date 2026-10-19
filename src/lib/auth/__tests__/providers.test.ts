import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { isGoogleSignInEnabled } from '@/lib/auth/providers'

describe('isGoogleSignInEnabled', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'pk')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('is true when the project has Google enabled', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ external: { google: true } }))
    expect(await isGoogleSignInEnabled()).toBe(true)
    expect(String(spy.mock.calls[0][0])).toBe('http://127.0.0.1:54321/auth/v1/settings')
  })

  it('is false when Google is off or the settings cannot be read', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ external: { google: false } }))
    expect(await isGoogleSignInEnabled()).toBe(false)
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('down'))
    expect(await isGoogleSignInEnabled()).toBe(false)
  })
})
