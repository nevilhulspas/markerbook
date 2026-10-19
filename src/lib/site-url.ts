/**
 * Public URL of this deployment (NEXT_PUBLIC_SITE_URL), for places that name
 * the app to third parties, e.g. a crawler User-Agent. Falls back to
 * localhost so a self-hosted dev setup works without it.
 */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

/**
 * Contact for third-party APIs that ask for one (Open Food Facts wants an
 * e-mail in the User-Agent). CONTACT_EMAIL when set, else the site URL.
 */
export function contactForUserAgent(): string {
  return process.env.CONTACT_EMAIL || siteUrl()
}
