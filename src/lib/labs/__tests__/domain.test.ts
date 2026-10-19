import { describe, it, expect } from 'vitest'
import { registrableDomain } from '@/lib/labs/domain'

describe('registrableDomain', () => {
  it('reduces a subdomain to its registrable domain', () => {
    expect(registrableDomain('shop.bodimed.com')).toBe('bodimed.com')
  })

  it('returns a bare domain unchanged', () => {
    expect(registrableDomain('bodimed.com')).toBe('bodimed.com')
  })

  it('treats www and deep subdomains as the same site', () => {
    expect(registrableDomain('www.bodimed.com')).toBe('bodimed.com')
    expect(registrableDomain('a.b.bodimed.com')).toBe('bodimed.com')
  })

  it('handles common two-part ccTLDs', () => {
    expect(registrableDomain('shop.bodimed.co.uk')).toBe('bodimed.co.uk')
  })
})
