import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The real transport pins DNS through undici; these tests drive the redirect
// and size logic through a mocked global fetch instead.
vi.mock('../pinned-fetch', () => ({
  pinnedFetch: (url: URL, init: RequestInit) => globalThis.fetch(url, init),
}))

// Stub server-only so the module loads in vitest (no Next runtime).
vi.mock('server-only', () => ({}))
// Stub analyze-homepage so importing scrape.ts doesn't construct the Anthropic
// client at module init (it would throw without ANTHROPIC_API_KEY).
vi.mock('@/lib/labs/analyze-homepage', () => ({ analyzeHomepage: vi.fn() }))
// Stub the SSRF guard with a pass-through: we're testing the SAME-DOMAIN guard
// here, not the SSRF guard (which has its own coverage and would require DNS).
vi.mock('@/lib/labs/url-guard', () => ({
  assertSafeScrapeUrl: async (raw: string) => new URL(raw),
}))
// robots.txt has its own tests (robots.test.ts); allow everything here so the
// fetch call counts below only count page fetches.
const { mockRobotsAllows } = vi.hoisted(() => ({ mockRobotsAllows: vi.fn(async () => true) }))
vi.mock('@/lib/labs/robots', () => ({
  LAB_BOT_USER_AGENT: 'MarkerbookLabBot/1.0 (+http://localhost:3000)',
  robotsAllows: mockRobotsAllows,
}))

import { fetchPageText } from '@/lib/labs/scrape'

function htmlResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

function redirectResponse(location: string): Response {
  return new Response(null, { status: 302, headers: { location } })
}

describe('fetchPageText — enforceSameRegistrableDomain', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('blocks an off-domain initial URL before any network call', async () => {
    const result = await fetchPageText('https://evil.example/produkt/r/', {
      enforceSameRegistrableDomain: 'bodimed.com',
    })
    expect(result).toEqual({ text: '', links: [] })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('blocks a cross-domain redirect (open-redirector defense)', async () => {
    // Initial URL is on the enforced domain, but the server redirects off-domain.
    fetchSpy.mockResolvedValueOnce(redirectResponse('https://attacker.example/page'))
    const result = await fetchPageText('https://bodimed.com/redirect?to=evil', {
      enforceSameRegistrableDomain: 'bodimed.com',
    })
    expect(result).toEqual({ text: '', links: [] })
    // The redirect must NOT be followed: exactly one fetch call (the initial one).
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('follows a same-registrable-domain redirect (www / subdomain)', async () => {
    fetchSpy
      .mockResolvedValueOnce(redirectResponse('https://www.bodimed.com/produkt/reverse-t3/'))
      .mockResolvedValueOnce(htmlResponse('<html><body>Reverse T3 page</body></html>'))
    const result = await fetchPageText('https://bodimed.com/produkt/reverse-t3', {
      enforceSameRegistrableDomain: 'bodimed.com',
    })
    expect(result.text).toContain('Reverse T3 page')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('without the option, follows any redirect (legacy behaviour preserved)', async () => {
    fetchSpy
      .mockResolvedValueOnce(redirectResponse('https://other.example/page'))
      .mockResolvedValueOnce(htmlResponse('<html><body>off-site content</body></html>'))
    const result = await fetchPageText('https://bodimed.com/r')
    // No enforceSameRegistrableDomain → no domain check, the cross-domain redirect
    // is followed (still SSRF-guarded, but that's mocked out here). Sanity that
    // adding the option is opt-in and doesn't change existing crawler behaviour.
    expect(result.text).toContain('off-site content')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})

describe('fetchPageText — robots.txt', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    mockRobotsAllows.mockImplementation(async () => true)
  })

  it('does not fetch a page that robots.txt disallows', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    mockRobotsAllows.mockImplementation(async () => false)
    const result = await fetchPageText('https://bodimed.com/private/tests')
    expect(result).toEqual({ text: '', links: [] })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
