import 'server-only'

import { assertSafeScrapeUrl } from './url-guard'
import { pinnedFetch } from './pinned-fetch'

const MAX_REDIRECTS = 5

export interface GuardedFetchOptions {
  headers: Record<string, string>
  signal?: AbortSignal
  /**
   * Extra check on each redirect target, after the SSRF guard. Return false to
   * stop: guardedFetch then returns null without fetching the target.
   */
  allowRedirect?: (from: URL, to: URL) => boolean
}

/**
 * The one outbound fetch for the lab scraper (pages and robots.txt). Follows
 * redirects manually so EVERY hop, the first included, passes
 * {@link assertSafeScrapeUrl}: a public URL that 302-redirects to
 * http://169.254.169.254/ is a classic SSRF bypass when fetch follows
 * redirects itself. Throws when a hop fails the SSRF guard; returns null when
 * `allowRedirect` refuses a hop. Otherwise returns the last response (a 3xx
 * when the redirect limit is hit or Location is missing) and its URL. The
 * socket itself re-checks the address it connects to (pinned-fetch.ts), so a
 * DNS answer that changes after the guard ran cannot reach a private address.
 */
export async function guardedFetch(
  url: string | URL,
  options: GuardedFetchOptions
): Promise<{ res: Response; url: URL } | null> {
  let current = await assertSafeScrapeUrl(url.toString())
  for (let hop = 0; ; hop++) {
    const res = await pinnedFetch(current, {
      signal: options.signal,
      redirect: 'manual',
      headers: options.headers,
    })
    if (res.status < 300 || res.status >= 400 || hop >= MAX_REDIRECTS) {
      return { res, url: current }
    }
    const location = res.headers.get('location')
    if (!location) return { res, url: current }
    const next = new URL(location, current)
    if (options.allowRedirect && !options.allowRedirect(current, next)) return null
    current = await assertSafeScrapeUrl(next.toString()) // re-guard each hop
  }
}

/** Read a stream into a string, stopping once `maxBytes` is reached. */
export async function readBounded(
  body: ReadableStream<Uint8Array>,
  maxBytes: number
): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: false })
  let received = 0
  let out = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      received += value.byteLength
      if (received > maxBytes) {
        const remaining = maxBytes - (received - value.byteLength)
        out += decoder.decode(value.subarray(0, Math.max(0, remaining)), {
          stream: false,
        })
        break
      }
      out += decoder.decode(value, { stream: true })
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  return out
}
