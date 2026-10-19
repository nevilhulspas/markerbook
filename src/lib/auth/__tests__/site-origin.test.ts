import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { resolveOrigin } from '../site-origin'

function hdrs(map: Record<string, string>): { get(n: string): string | null } {
  const lower = Object.fromEntries(Object.entries(map).map(([k, v]) => [k.toLowerCase(), v]))
  return { get: (n: string) => lower[n.toLowerCase()] ?? null }
}

describe('resolveOrigin', () => {
  const prev = process.env.NEXT_PUBLIC_SITE_URL
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://health.example.com'
  })
  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = prev
  })

  it('uses x-forwarded-host (the public prod domain) when present', () => {
    expect(
      resolveOrigin(hdrs({ 'x-forwarded-host': 'health.example.com', 'x-forwarded-proto': 'https' }))
    ).toBe('https://health.example.com')
  })

  it('keeps a portless dev host (subdomain ...localhost:1355 is NOT bare localhost)', () => {
    expect(
      resolveOrigin(hdrs({ 'x-forwarded-host': 'aut-889.bloodmarkers-tracker.localhost:1355' }))
    ).toBe('https://aut-889.bloodmarkers-tracker.localhost:1355')
  })

  it('falls back to NEXT_PUBLIC_SITE_URL when the only host is the bare-localhost internal one (the prod-proxy bug)', () => {
    // request.url / internal host the container sees behind Traefik.
    expect(resolveOrigin(hdrs({ host: 'localhost:3000' }))).toBe(
      'https://health.example.com'
    )
    expect(resolveOrigin(hdrs({ host: '127.0.0.1:3000' }))).toBe(
      'https://health.example.com'
    )
  })

  it('prefers x-forwarded-host over a bare host header', () => {
    expect(
      resolveOrigin(hdrs({ 'x-forwarded-host': 'health.example.com', host: 'localhost:3000' }))
    ).toBe('https://health.example.com')
  })

  it('rejects a spoofed/unknown x-forwarded-host (open-redirect guard) → NEXT_PUBLIC_SITE_URL', () => {
    expect(resolveOrigin(hdrs({ 'x-forwarded-host': 'evil.com' }))).toBe(
      'https://health.example.com'
    )
  })

  it('handles a comma-joined x-forwarded-host by taking the first value (no unparseable URL)', () => {
    // legit value first → used
    expect(
      resolveOrigin(hdrs({ 'x-forwarded-host': 'health.example.com, evil.com' }))
    ).toBe('https://health.example.com')
    // spoofed value first → untrusted → falls back (never returns the joined string)
    expect(
      resolveOrigin(hdrs({ 'x-forwarded-host': 'evil.com, health.example.com' }))
    ).toBe('https://health.example.com')
  })

  it('last resort: returns the host as-is when bare-localhost AND no NEXT_PUBLIC_SITE_URL', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    expect(resolveOrigin(hdrs({ host: 'localhost:3000', 'x-forwarded-proto': 'http' }))).toBe(
      'http://localhost:3000'
    )
  })
})
