import { describe, it, expect } from 'vitest'

import { AUTH_COOKIE_OPTIONS } from '../cookie-options'

// Regression guard. The server-set Supabase auth cookie MUST stay `httpOnly`
// so iOS/WebKit (Safari + the Capacitor WKWebView) keeps it instead of purging
// the JavaScript-set cookie on every relaunch. This behaviour has been reverted
// twice before — if someone drops `httpOnly`, this test fails loudly.
describe('AUTH_COOKIE_OPTIONS', () => {
  it('keeps the auth cookie server-owned (httpOnly)', () => {
    expect(AUTH_COOKIE_OPTIONS.httpOnly).toBe(true)
  })

  it('does not pin `secure` or `sameSite` — a Secure mismatch caused the May 2026 logout regression', () => {
    // Leaving these to @supabase/ssr's defaults keeps client/server cookies in
    // agreement and keeps http://…localhost dev logins working.
    expect(AUTH_COOKIE_OPTIONS.secure).toBeUndefined()
    expect(AUTH_COOKIE_OPTIONS.sameSite).toBeUndefined()
  })
})
