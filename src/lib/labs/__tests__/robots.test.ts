import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The real transport pins DNS through undici; these tests drive the redirect
// and size logic through a mocked global fetch instead.
vi.mock('../pinned-fetch', () => ({
  pinnedFetch: (url: URL, init: RequestInit) => globalThis.fetch(url, init),
}))

vi.mock('server-only', () => ({}))
// The real SSRF guard runs; resolve every hostname to a public address so it
// only rejects literal private IPs and localhost.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}))

import { clearRobotsCache, isAllowed, parseRobots, robotsAllows } from '@/lib/labs/robots'

describe('parseRobots / isAllowed', () => {
  it('uses the * group when no group names the bot', () => {
    const rules = parseRobots('User-agent: *\nDisallow: /admin\n')
    expect(isAllowed(rules, '/admin/x')).toBe(false)
    expect(isAllowed(rules, '/tests')).toBe(true)
  })

  it('prefers a group that names the bot over the * group', () => {
    const body = [
      'User-agent: *',
      'Disallow: /',
      '',
      'User-agent: MarkerbookLabBot',
      'Disallow: /cart',
    ].join('\n')
    const rules = parseRobots(body)
    expect(isAllowed(rules, '/tests')).toBe(true)
    expect(isAllowed(rules, '/cart')).toBe(false)
  })

  it('lets the longest match win, Allow on a tie', () => {
    const rules = parseRobots('User-agent: *\nDisallow: /shop\nAllow: /shop/tests\n')
    expect(isAllowed(rules, '/shop/tests/ferritin')).toBe(true)
    expect(isAllowed(rules, '/shop/cart')).toBe(false)
  })

  it('supports * and $ in patterns, and an empty Disallow allows all', () => {
    const rules = parseRobots('User-agent: *\nDisallow: /*.pdf$\nDisallow:\n')
    expect(isAllowed(rules, '/files/report.pdf')).toBe(false)
    expect(isAllowed(rules, '/files/report.pdf?x=1')).toBe(true)
    expect(isAllowed(rules, '/tests')).toBe(true)
  })

  it('treats a user-agent line after rules as a new group', () => {
    const body = 'User-agent: other\nDisallow: /\nUser-agent: *\nDisallow: /private\n'
    const rules = parseRobots(body)
    expect(isAllowed(rules, '/tests')).toBe(true)
    expect(isAllowed(rules, '/private')).toBe(false)
  })
})

describe('robotsAllows', () => {
  beforeEach(() => clearRobotsCache())
  afterEach(() => vi.restoreAllMocks())

  it('allows everything when robots.txt is missing (4xx)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }))
    expect(await robotsAllows(new URL('https://lab.example/tests'))).toBe(true)
  })

  it('disallows when robots.txt fails (5xx) and retries on the next call', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('User-agent: *\nDisallow:\n', { status: 200 }))
    expect(await robotsAllows(new URL('https://lab.example/tests'))).toBe(false)
    expect(await robotsAllows(new URL('https://lab.example/tests'))).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('reads robots.txt once per origin', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('User-agent: *\nDisallow: /cart\n', { status: 200 }))
    expect(await robotsAllows(new URL('https://lab.example/tests'))).toBe(true)
    expect(await robotsAllows(new URL('https://lab.example/cart'))).toBe(false)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0][0])).toBe('https://lab.example/robots.txt')
  })
})

describe('robotsAllows — SSRF guard and size cap', () => {
  beforeEach(() => clearRobotsCache())
  afterEach(() => vi.restoreAllMocks())

  it.each(['http://127.0.0.1/robots.txt', 'http://169.254.169.254/latest', 'http://localhost/robots.txt'])(
    'refuses a redirect to %s and treats robots.txt as unreachable',
    async (target) => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(null, { status: 302, headers: { location: target } }))
      expect(await robotsAllows(new URL('https://lab.example/tests'))).toBe(false)
      // Only the first request went out; the private target was never fetched.
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy.mock.calls[0][1]).toMatchObject({ redirect: 'manual' })
    }
  )

  it('follows a redirect to another public host', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(null, { status: 301, headers: { location: 'https://www.lab.example/robots.txt' } })
      )
      .mockResolvedValueOnce(new Response('User-agent: *\nDisallow: /cart\n', { status: 200 }))
    expect(await robotsAllows(new URL('https://lab.example/cart'))).toBe(false)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(String(fetchSpy.mock.calls[1][0])).toBe('https://www.lab.example/robots.txt')
  })

  it('refuses robots.txt on a private origin without fetching', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect(await robotsAllows(new URL('http://10.0.0.1/tests'))).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('reads at most 500 KB of the body', async () => {
    // A Disallow line past the cap is never read, so /secret stays allowed.
    const padding = 'Allow: /x\n'.repeat(60_000) // ~600 KB
    const body = `User-agent: *\n${padding}Disallow: /secret\n`
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, { status: 200 }))
    expect(await robotsAllows(new URL('https://lab.example/secret'))).toBe(true)
  })
})
