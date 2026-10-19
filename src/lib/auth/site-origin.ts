// Single source of truth for "what public origin is this request on?" — used to
// build the OAuth `redirectTo` and the post-callback redirect.
//
// Why not `new URL(request.url).origin`? Behind our prod reverse proxy
// (Dokploy/Traefik) the Next container only sees its INTERNAL address, so
// `request.url` resolves to `http://localhost:3000/...`. Redirecting to that
// origin after the OAuth code exchange bounced users to localhost:3000 in
// production (AUT-889). The forwarded headers carry the real public host.

type HeaderGetter = { get(name: string): string | null }

/** True for the container-internal host the proxy didn't rewrite (NOT a
 *  portless dev host like `x.bloodmarkers-tracker.localhost:1355`). */
function isBareLocalhost(host: string): boolean {
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)
}

/**
 * Only redirect to hosts we actually own — otherwise a spoofed `x-forwarded-host`
 * (a request that bypasses the proxy, or a proxy that forwards a client-supplied
 * value) could turn the OAuth callback into an open redirect off-site. Trusted =
 * the configured canonical host (NEXT_PUBLIC_SITE_URL) or a portless per-worktree
 * dev host (`*.bloodmarkers-tracker.localhost`).
 */
function isTrustedHost(host: string): boolean {
  if (!host) return false
  const h = host.toLowerCase()
  if (/(^|\.)bloodmarkers-tracker\.localhost(:\d+)?$/.test(h)) return true
  const site = process.env.NEXT_PUBLIC_SITE_URL
  if (site) {
    try {
      if (h === new URL(site).host.toLowerCase()) return true
    } catch {
      // malformed env — ignore, fall through to untrusted
    }
  }
  return false
}

/**
 * Resolve the request's public origin (e.g. `https://health.example.com`
 * in prod, `https://aut-889.bloodmarkers-tracker.localhost:1355` in portless dev).
 *
 * Trust `x-forwarded-host`/`host` only when it's a host we own (isTrustedHost);
 * otherwise — bare-localhost proxy-internal host, or a spoofed/unknown host —
 * fall back to the configured `NEXT_PUBLIC_SITE_URL`. A repeated forwarded header
 * is comma-joined per the Fetch spec, so we take the first value (a joined string
 * would otherwise produce an unparseable redirect URL → 500).
 */
export function resolveOrigin(headers: HeaderGetter): string {
  const firstValue = (v: string | null): string => (v ?? '').split(',')[0].trim()
  const host = firstValue(headers.get('x-forwarded-host') ?? headers.get('host'))
  const proto = firstValue(headers.get('x-forwarded-proto')) || 'https'

  if (host && !isBareLocalhost(host) && isTrustedHost(host)) {
    return `${proto}://${host}`
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }
  return host ? `${proto}://${host}` : 'http://localhost:3000'
}
