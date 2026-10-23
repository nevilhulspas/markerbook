import { describe, it, expect } from 'vitest'

import { buildContentSecurityPolicy, buildSecurityHeaders } from '../security-headers'

function directive(csp: string, name: string): string[] {
  const found = csp.split('; ').find((d) => d.startsWith(`${name} `))
  return found ? found.split(' ').slice(1) : []
}

describe('buildContentSecurityPolicy', () => {
  const prod = buildContentSecurityPolicy({ supabaseUrl: 'https://abc.supabase.co/', isDev: false })

  it('lets the browser reach Supabase over https and wss', () => {
    expect(directive(prod, 'connect-src')).toEqual(
      expect.arrayContaining(["'self'", 'https://abc.supabase.co', 'wss://abc.supabase.co'])
    )
    expect(directive(prod, 'img-src')).toContain('https://abc.supabase.co')
  })

  it('does not allow arbitrary remote hosts for images or fetches', () => {
    for (const name of ['img-src', 'connect-src']) {
      const values = directive(prod, name)
      expect(values).not.toContain('https:')
      expect(values).not.toContain('*')
      expect(values).not.toContain('http:')
    }
  })

  it('locks down framing, plugins, base and forms', () => {
    expect(directive(prod, 'frame-ancestors')).toEqual(["'none'"])
    expect(directive(prod, 'object-src')).toEqual(["'none'"])
    expect(directive(prod, 'base-uri')).toEqual(["'self'"])
    expect(directive(prod, 'form-action')).toEqual(["'self'"])
  })

  it('allows eval and local Supabase only in development', () => {
    expect(directive(prod, 'script-src')).not.toContain("'unsafe-eval'")
    expect(prod).not.toContain('127.0.0.1')

    const dev = buildContentSecurityPolicy({ supabaseUrl: undefined, isDev: true })
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'")
    expect(directive(dev, 'connect-src')).toEqual(
      expect.arrayContaining(['http://127.0.0.1:54321', 'ws://127.0.0.1:54321', 'http://localhost:54321'])
    )
  })

  it('skips a missing or malformed Supabase URL instead of throwing', () => {
    expect(() => buildContentSecurityPolicy({ supabaseUrl: 'not a url', isDev: false })).not.toThrow()
    const csp = buildContentSecurityPolicy({ supabaseUrl: undefined, isDev: false })
    expect(directive(csp, 'connect-src')).toEqual(["'self'", 'data:', 'blob:'])
  })
})

describe('buildSecurityHeaders', () => {
  it('sends HSTS and the hardening headers in production', () => {
    const headers = Object.fromEntries(
      buildSecurityHeaders({ supabaseUrl: 'https://abc.supabase.co', isDev: false }).map((h) => [h.key, h.value])
    )
    expect(headers['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains')
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['Permissions-Policy']).toContain('camera=(self)')
    expect(headers['Permissions-Policy']).toContain('microphone=(self)')
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'")
  })

  it('leaves HSTS off in development', () => {
    const keys = buildSecurityHeaders({ isDev: true }).map((h) => h.key)
    expect(keys).not.toContain('Strict-Transport-Security')
  })
})
