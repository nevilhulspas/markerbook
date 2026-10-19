// Common two-part ccTLD suffixes, so e.g. "shop.lab.co.uk" resolves to
// "lab.co.uk" rather than "co.uk" — otherwise the whole .co.uk namespace would
// pass the same-site check. Extend as needed.
const MULTI_PART_TLDS = new Set([
  'co.uk', 'org.uk', 'me.uk', 'net.uk', 'ltd.uk', 'plc.uk',
  'co.au', 'org.au', 'net.au', 'com.au', 'id.au',
  'co.nz', 'org.nz', 'net.nz', 'co.za', 'org.za',
  'co.jp', 'ne.jp', 'or.jp', 'co.in', 'org.in', 'net.in',
  'com.br', 'org.br', 'net.br',
])

/**
 * Approximate registrable domain (e.g. "shop.bodimed.com" -> "bodimed.com",
 * "shop.bodimed.co.uk" -> "bodimed.co.uk"). Good enough for same-site checks;
 * handles common two-part ccTLDs so a whole ccTLD namespace can't pass as one
 * site.
 */
export function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().split('.').filter(Boolean)
  if (labels.length <= 2) return labels.join('.')
  const twoPartTld = labels.slice(-2).join('.')
  if (MULTI_PART_TLDS.has(twoPartTld)) return labels.slice(-3).join('.')
  return twoPartTld
}
