import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { isPrivateIp, assertSafeScrapeUrl } from '../url-guard'

describe('isPrivateIp', () => {
  it('returns true for private / loopback / link-local / CGNAT IPv4', () => {
    expect(isPrivateIp('10.1.2.3')).toBe(true)
    expect(isPrivateIp('192.168.0.1')).toBe(true)
    expect(isPrivateIp('172.16.5.5')).toBe(true)
    expect(isPrivateIp('127.0.0.1')).toBe(true)
    expect(isPrivateIp('169.254.1.1')).toBe(true)
  })

  it('returns true for IPv6 loopback and link-local', () => {
    expect(isPrivateIp('::1')).toBe(true)
    expect(isPrivateIp('fe80::1')).toBe(true)
  })

  it('returns true for IPv4-mapped IPv6 reaching private/metadata IPs (dotted + hex forms)', () => {
    // Dotted form
    expect(isPrivateIp('::ffff:169.254.169.254')).toBe(true)
    expect(isPrivateIp('::ffff:10.0.0.1')).toBe(true)
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true)
    // Hex form, as produced by new URL().hostname normalization
    expect(isPrivateIp('::ffff:a9fe:a9fe')).toBe(true) // 169.254.169.254
    expect(isPrivateIp('::ffff:0a00:0001')).toBe(true) // 10.0.0.1
    expect(isPrivateIp('::ffff:7f00:0001')).toBe(true) // 127.0.0.1
  })

  it('returns true for NAT64 well-known prefix', () => {
    expect(isPrivateIp('64:ff9b::a9fe:a9fe')).toBe(true)
  })

  it('returns false for public addresses', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false)
    expect(isPrivateIp('1.1.1.1')).toBe(false)
    expect(isPrivateIp('93.184.216.34')).toBe(false)
    // Public IPv4-mapped IPv6 (8.8.8.8 == ::ffff:808:808) stays public.
    expect(isPrivateIp('::ffff:808:808')).toBe(false)
  })
})

describe('assertSafeScrapeUrl', () => {
  it('rejects localhost', async () => {
    await expect(assertSafeScrapeUrl('http://localhost')).rejects.toThrow()
  })

  it('rejects loopback literal IP', async () => {
    await expect(assertSafeScrapeUrl('http://127.0.0.1')).rejects.toThrow()
  })

  it('rejects the cloud metadata link-local address', async () => {
    await expect(
      assertSafeScrapeUrl('http://169.254.169.254/')
    ).rejects.toThrow()
  })

  it('rejects a private 10.0.0.0/8 IP', async () => {
    await expect(assertSafeScrapeUrl('http://10.0.0.5')).rejects.toThrow()
  })

  it('rejects IPv4-mapped IPv6 literals reaching private/metadata IPs', async () => {
    await expect(
      assertSafeScrapeUrl('http://[::ffff:169.254.169.254]/')
    ).rejects.toThrow()
    await expect(
      assertSafeScrapeUrl('http://[::ffff:10.0.0.1]/')
    ).rejects.toThrow()
  })

  it('rejects non-http(s) protocols', async () => {
    await expect(assertSafeScrapeUrl('ftp://example.com')).rejects.toThrow()
    await expect(assertSafeScrapeUrl('javascript:alert(1)')).rejects.toThrow()
    await expect(
      assertSafeScrapeUrl('file:///etc/passwd')
    ).rejects.toThrow()
  })
})
