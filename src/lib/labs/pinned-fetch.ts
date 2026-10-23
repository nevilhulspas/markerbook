import 'server-only'

import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns'
import { Agent, fetch as undiciFetch } from 'undici'

import { isPrivateIp } from './url-guard'

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number
) => void

/**
 * DNS lookup for the scraper's sockets that refuses private addresses. The
 * URL guard checks a host's addresses once, but a plain fetch resolves the
 * name AGAIN when it connects — a host can answer "public" to the guard and
 * "169.254.169.254" to the socket (DNS rebinding). Checking here, on the
 * address the socket really connects to, closes that gap.
 */
export function safeLookup(hostname: string, options: LookupOptions, callback: LookupCallback): void {
  dnsLookup(hostname, options, (err, address, family) => {
    if (err) return callback(err, address as string, family)
    const addresses = Array.isArray(address) ? address.map((a) => a.address) : [address]
    if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a))) {
      const refused = Object.assign(new Error(`Refusing to connect to a private address for ${hostname}`), {
        code: 'EPRIVATEADDR',
      })
      return callback(refused, address as string, family)
    }
    callback(null, address as string, family)
  })
}

const agent = new Agent({ connect: { lookup: safeLookup } })

/** fetch for the lab scraper: same API, but every connection uses safeLookup. */
export async function pinnedFetch(url: URL, init: { signal?: AbortSignal; redirect: 'manual'; headers: Record<string, string> }): Promise<Response> {
  // undici's Response is the same WHATWG Response the rest of the code reads.
  return (await undiciFetch(url, { ...init, dispatcher: agent })) as unknown as Response
}
