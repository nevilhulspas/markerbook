export const DEFAULT_NEXT_PATH = '/dashboard'

const AUTH_PAGE_PREFIXES = ['/login', '/register', '/auth']

/** Segment-aware match so e.g. `/login-activity` is not treated as an auth page. */
function isAuthPagePath(path: string): boolean {
  return AUTH_PAGE_PREFIXES.some(
    (prefix) =>
      path === prefix ||
      path.startsWith(`${prefix}/`) ||
      path.startsWith(`${prefix}?`)
  )
}

const PLACEHOLDER_ORIGIN = 'https://placeholder.invalid'

// Control and format characters (tab, newline, zero-width…), any whitespace
// or separator, and backslashes. Browsers drop tab/newline from URLs and read
// `\` as `/`, so `/\t/evil.com` or `/\evil.com` becomes `//evil.com`.
const UNSAFE_CHARS = /[\p{Cc}\p{Cf}\p{Z}\s\\]/u

/** Percent-decode until stable (a few rounds), or null when malformed. */
function fullyDecode(value: string): string | null {
  let current = value
  for (let i = 0; i < 3; i++) {
    let decoded: string
    try {
      decoded = decodeURIComponent(current)
    } catch {
      return null
    }
    if (decoded === current) return current
    current = decoded
  }
  return current
}

function isUnsafeForm(value: string): boolean {
  return !value.startsWith('/') || value.startsWith('//') || UNSAFE_CHARS.test(value)
}

/**
 * Sanitize a post-login `next` redirect target. Only same-app paths are
 * allowed — anything absolute (`https://…`, `javascript:`), protocol-relative
 * (`//evil.com`, `/\evil.com`, `/%09/evil.com`, `/%2F/evil.com`), carrying
 * control characters or whitespace (raw or percent-encoded) or pointing back
 * at the auth pages falls through to the dashboard, so the param can never be
 * abused as an open redirect. Returns the normalised path + query + hash.
 */
export function sanitizeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_NEXT_PATH
  const decoded = fullyDecode(raw)
  if (decoded === null || isUnsafeForm(raw) || isUnsafeForm(decoded)) {
    return DEFAULT_NEXT_PATH
  }

  let url: URL
  try {
    url = new URL(raw, PLACEHOLDER_ORIGIN)
  } catch {
    return DEFAULT_NEXT_PATH
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return DEFAULT_NEXT_PATH

  const path = `${url.pathname}${url.search}${url.hash}`
  if (url.pathname === '/' || isAuthPagePath(path) || isUnsafeForm(path)) {
    return DEFAULT_NEXT_PATH
  }
  return path
}
