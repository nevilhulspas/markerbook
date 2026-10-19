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
})
