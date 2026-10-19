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

/**
 * Sanitize a post-login `next` redirect target. Only same-app paths are
 * allowed — anything absolute (`https://…`), protocol-relative (`//evil.com`,
 * `/\evil.com`) or pointing back at the auth pages falls through to the
 * dashboard, so the param can never be abused as an open redirect.
 */
export function sanitizeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_NEXT_PATH
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return DEFAULT_NEXT_PATH
  }
  if (raw === '/' || isAuthPagePath(raw)) {
    return DEFAULT_NEXT_PATH
  }
  return raw
}
