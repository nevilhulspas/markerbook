import { describe, it, expect } from 'vitest'

import { DEFAULT_NEXT_PATH, sanitizeNextPath } from '../next-path'

describe('sanitizeNextPath', () => {
  it('passes through internal paths, including query strings', () => {
    expect(sanitizeNextPath('/nutrition')).toBe('/nutrition')
    expect(sanitizeNextPath('/labs/abc?tab=history')).toBe(
      '/labs/abc?tab=history'
    )
  })

  it('falls back to the dashboard when missing', () => {
    expect(sanitizeNextPath(undefined)).toBe(DEFAULT_NEXT_PATH)
    expect(sanitizeNextPath(null)).toBe(DEFAULT_NEXT_PATH)
    expect(sanitizeNextPath('')).toBe(DEFAULT_NEXT_PATH)
  })

  it('rejects external and protocol-relative URLs', () => {
    expect(sanitizeNextPath('https://evil.com')).toBe(DEFAULT_NEXT_PATH)
    expect(sanitizeNextPath('//evil.com')).toBe(DEFAULT_NEXT_PATH)
    expect(sanitizeNextPath('/\\evil.com')).toBe(DEFAULT_NEXT_PATH)
  })

  it('rejects auth pages and the root to avoid redirect loops', () => {
    expect(sanitizeNextPath('/')).toBe(DEFAULT_NEXT_PATH)
    expect(sanitizeNextPath('/login')).toBe(DEFAULT_NEXT_PATH)
    expect(sanitizeNextPath('/login?next=%2Fnutrition')).toBe(DEFAULT_NEXT_PATH)
    expect(sanitizeNextPath('/register')).toBe(DEFAULT_NEXT_PATH)
    expect(sanitizeNextPath('/auth/callback')).toBe(DEFAULT_NEXT_PATH)
  })

  it('only blocks whole auth segments, not lookalike routes', () => {
    expect(sanitizeNextPath('/login-activity')).toBe('/login-activity')
    expect(sanitizeNextPath('/registered-users')).toBe('/registered-users')
    expect(sanitizeNextPath('/authorizations')).toBe('/authorizations')
  })

  it.each([
    ['tab (verified bypass: /login?next=/%09/example.com)', '/\t/example.com'],
    ['newline', '/\n/example.com'],
    ['carriage return', '/\r/example.com'],
    ['leading tab', '\t//example.com'],
    ['space', '/ /example.com'],
    ['no-break space', '/\u00a0/example.com'],
    ['line separator', '/\u2028/example.com'],
    ['zero-width space', '/\u200b/example.com'],
    ['encoded tab', '/%09/example.com'],
    ['encoded newline', '/%0A/example.com'],
    ['encoded carriage return', '/%0d/example.com'],
    ['encoded space', '/%20/example.com'],
    ['double-encoded tab', '/%2509/example.com'],
    ['encoded slashes', '/%2F%2Fexample.com'],
    ['encoded slash after one', '/%2Fexample.com'],
    ['fully encoded protocol-relative', '%2F%2Fexample.com'],
    ['backslash', '/\\example.com'],
    ['backslash later in the path', '/ok\\..\\example.com'],
    ['encoded backslash', '/%5Cexample.com'],
    ['three slashes', '///example.com'],
    ['scheme', 'https://x'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['encoded javascript scheme', 'javascript%3Aalert(1)'],
    ['data scheme', 'data:text/html,hi'],
    ['relative path', 'dashboard'],
    ['malformed percent-encoding', '/%E0%A4%A'],
  ])('rejects %s', (_label, value) => {
    expect(sanitizeNextPath(value)).toBe(DEFAULT_NEXT_PATH)
  })

  it('keeps query and hash on a same-app path', () => {
    expect(sanitizeNextPath('/ok?x=1#y')).toBe('/ok?x=1#y')
    expect(sanitizeNextPath('/labs/abc?tab=history&next=%2Fx')).toBe(
      '/labs/abc?tab=history&next=%2Fx'
    )
  })

  it('normalises dot segments before the auth-page check', () => {
    expect(sanitizeNextPath('/x/../nutrition')).toBe('/nutrition')
    expect(sanitizeNextPath('/x/../login')).toBe(DEFAULT_NEXT_PATH)
  })

  it('is idempotent', () => {
    for (const value of ['/ok?x=1#y', '/café', '/labs/abc?tab=history']) {
      const once = sanitizeNextPath(value)
      expect(sanitizeNextPath(once)).toBe(once)
    }
  })
})
