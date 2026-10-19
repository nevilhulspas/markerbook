import 'server-only'

import { lookup } from 'node:dns/promises'

/**
 * SSRF protection for the admin "scrape a lab website" feature.
 *
 * Both functions below are the security core: every outbound fetch MUST pass
 * through {@link assertSafeScrapeUrl} so we never let an admin (or a redirect /
 * crawled link) point the server at an internal service.
 */

/**
 * Returns true if `ip` is a private, loopback, link-local, CGNAT, or otherwise
 * non-public address (IPv4 or IPv6). PURE — no I/O.
 */
export function isPrivateIp(ip: string): boolean {
  const addr = ip.trim().toLowerCase()
  if (addr.length === 0) return true

  // IPv4-mapped IPv6, dotted form (e.g. ::ffff:10.0.0.1) — evaluate the
  // embedded IPv4. (The hex form, e.g. ::ffff:a9fe:a9fe, is handled inside
  // isPrivateIpv6.)
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIpv4(mapped[1])

  if (addr.includes(':')) return isPrivateIpv6(addr)
  return isPrivateIpv4(addr)
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4) return true // not a valid IPv4 — treat as unsafe

  const octets = parts.map((p) => Number(p))
  if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return true

  const [a, b] = octets

  // 0.0.0.0/8 — "this network"
  if (a === 0) return true
  // 10.0.0.0/8 — private
  if (a === 10) return true
  // 127.0.0.0/8 — loopback
  if (a === 127) return true
  // 169.254.0.0/16 — link-local
  if (a === 169 && b === 254) return true
  // 172.16.0.0/12 — private
  if (a === 172 && b >= 16 && b <= 31) return true
  // 192.168.0.0/16 — private
  if (a === 192 && b === 168) return true
  // 100.64.0.0/10 — CGNAT
  if (a === 100 && b >= 64 && b <= 127) return true

  return false
}

function isPrivateIpv6(ip: string): boolean {
  // Strip a zone index if present (e.g. fe80::1%eth0).
  const addr = ip.split('%')[0]

  // ::1 — loopback. :: — unspecified.
  if (addr === '::1' || addr === '::') return true

  // IPv4-mapped IPv6 in hex form (e.g. ::ffff:a9fe:a9fe == ::ffff:169.254.169.254).
  // new URL().hostname normalizes ::ffff:1.2.3.4 to this hex form, so without
  // decoding it here the embedded private/metadata IPv4 would slip through.
  const hexMapped = addr.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16)
    const lo = parseInt(hexMapped[2], 16)
    return isPrivateIpv4(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`)
  }

  // 64:ff9b::/96 — NAT64 well-known prefix (can embed private IPv4). Treat as unsafe.
  if (/^64:ff9b:/i.test(addr)) return true

  const firstHextet = addr.split(':')[0]
  // Fail closed: any unclassified `::`-prefixed (or otherwise empty-first-hextet)
  // address is treated as private/unsafe rather than assumed public.
  if (firstHextet.length === 0) return true

  const value = parseInt(firstHextet, 16)
  if (Number.isNaN(value)) return true // unparseable — treat as unsafe

  // fc00::/7 — unique-local (fc00–fdff).
  if ((value & 0xfe00) === 0xfc00) return true
  // fe80::/10 — link-local (fe80–febf).
  if ((value & 0xffc0) === 0xfe80) return true

  return false
}

/**
 * Throws unless `rawUrl` is safe to fetch server-side:
 *  - protocol is http: or https:
 *  - hostname is not localhost / *.local / empty
 *  - every DNS-resolved address (or the literal IP) is public
 *
 * Returns the parsed URL on success.
 *
 * Known limitation: DNS-rebinding TOCTOU — the host is resolved here but the
 * subsequent fetch resolves DNS again, so a record that flips to a private IP
 * between the two lookups could bypass this guard. Mitigating it fully needs
 * pinning the resolved IP through to the fetch (out of scope here).
 */
export async function assertSafeScrapeUrl(rawUrl: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('Only public http(s) URLs can be scraped')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only public http(s) URLs can be scraped')
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '') // strip IPv6 brackets
  if (
    host.length === 0 ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === 'local' ||
    host.endsWith('.local')
  ) {
    throw new Error('Only public http(s) URLs can be scraped')
  }

  // If the host is already a literal IP, check it directly (no DNS needed).
  if (isIpLiteral(host)) {
    if (isPrivateIp(host)) {
      throw new Error('Only public http(s) URLs can be scraped')
    }
    return url
  }

  // Otherwise resolve and ensure EVERY resolved address is public.
  let addresses: { address: string; family: number }[]
  try {
    addresses = await lookup(host, { all: true })
  } catch {
    throw new Error('Only public http(s) URLs can be scraped')
  }

  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new Error('Only public http(s) URLs can be scraped')
  }

  return url
}

/** True if `host` looks like a literal IPv4 or IPv6 address (not a domain). */
function isIpLiteral(host: string): boolean {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return true
  // IPv6 literals contain a colon; domains never do.
  return host.includes(':')
}
