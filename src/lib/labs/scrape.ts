import 'server-only'

import { analyzeHomepage } from './analyze-homepage'
import { registrableDomain } from './domain'
import { guardedFetch, readBounded } from './guarded-fetch'
import { LAB_BOT_USER_AGENT, robotsAllows } from './robots'
import { ScrapeRejectedError } from './scrape-errors'
import { assertSafeScrapeUrl } from './url-guard'

const FETCH_TIMEOUT_MS = 10_000
const MAX_BODY_BYTES = 1_500_000 // ~1.5 MB per page
const MAX_TOTAL_CHARS = 350_000 // whole catalogue; extraction chunks this text
const MAX_SUBPAGES = 60 // safety cap on catalogue/pagination pages we follow
const SUBPAGE_CONCURRENCY = 6 // fetch sub-pages in parallel (bounded)
const MAX_CANDIDATE_LINKS = 150 // bound the homepage-analysis prompt

// Same-domain pagination links (e.g. ?page=2, /page/3/) — followed for one
// extra bounded round to capture catalogues that split tests across pages.
const PAGINATION_LINK_RE = /[?&]page=\d+|\/page\/\d+\/?$/i

export interface FetchPageTextOptions {
  /**
   * If set, the initial URL AND every redirect hop must share this hostname's
   * registrable domain — otherwise the fetch returns empty. Defends against
   * an open-redirector on the trusted site bouncing us to attacker-controlled
   * content (which would then be passed to the LLM extractor and accepted as
   * data attributed to the trusted site). Pass `new URL(lab.website).hostname`.
   */
  enforceSameRegistrableDomain?: string
}

/**
 * Fetch a single page, returning its plain text and absolute anchor links.
 * SSRF-guarded: the URL is validated before any network access. On any error
 * (guard rejection, timeout, non-OK status, oversized body, or — when
 * `enforceSameRegistrableDomain` is set — a cross-domain initial URL or
 * redirect hop) returns empty.
 */
export async function fetchPageText(
  url: string,
  options?: FetchPageTextOptions
): Promise<{ text: string; links: string[] }> {
  const requiredDomain = options?.enforceSameRegistrableDomain
    ? registrableDomain(options.enforceSameRegistrableDomain.toLowerCase())
    : null

  let safeUrl: URL
  try {
    safeUrl = await assertSafeScrapeUrl(url)
  } catch (err) {
    console.error('fetchPageText: blocked unsafe URL', url, err)
    return { text: '', links: [] }
  }

  if (
    requiredDomain !== null &&
    registrableDomain(safeUrl.hostname.toLowerCase()) !== requiredDomain
  ) {
    console.error(
      'fetchPageText: blocked off-domain initial URL',
      url,
      'expected domain',
      requiredDomain
    )
    return { text: '', links: [] }
  }

  // Respect the site's robots.txt for the page we are asked to fetch.
  if (!(await robotsAllows(safeUrl))) {
    console.error('fetchPageText: disallowed by robots.txt', url)
    return { text: '', links: [] }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    // guardedFetch re-validates EACH redirect hop with the SSRF guard; the
    // same-registrable-domain check below stops a redirect to an
    // attacker-controlled host, an open-redirector bypass of caller-level
    // domain checks.
    const fetched = await guardedFetch(safeUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': LAB_BOT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      allowRedirect: (from, to) => {
        if (
          requiredDomain === null ||
          registrableDomain(to.hostname.toLowerCase()) === requiredDomain
        ) {
          return true
        }
        console.error(
          'fetchPageText: blocked off-domain redirect',
          from.toString(),
          '->',
          to.toString(),
          'expected domain',
          requiredDomain
        )
        return false
      },
    })
    if (!fetched) return { text: '', links: [] }
    const { res, url: current } = fetched

    if (!res.ok || !res.body) {
      return { text: '', links: [] }
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (contentType && !/text\/html|application\/xhtml|text\/plain/i.test(contentType)) {
      return { text: '', links: [] }
    }

    const html = await readBounded(res.body, MAX_BODY_BYTES)
    const links = extractLinks(html, current)
    const text = htmlToText(html)
    return { text, links }
  } catch (err) {
    console.error('fetchPageText: fetch failed', url, err)
    return { text: '', links: [] }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Crawl a lab's catalogue, LLM-driven. Fetches the homepage, asks
 * {@link analyzeHomepage} whether the site is a genuine lab test catalogue and
 * which same-domain links to follow, REJECTS sites that aren't a lab catalogue
 * or look like a prompt-injection / manipulation attempt (throwing
 * {@link ScrapeRejectedError}), then fetches the selected catalogue/category
 * pages plus one extra bounded round of pagination pages. Returns the
 * concatenated plain text capped at {@link MAX_TOTAL_CHARS}. Every fetched URL
 * is re-guarded inside {@link fetchPageText}, and the URLs we follow are only
 * ever a subset of the same-domain candidate links — the model cannot introduce
 * a new/unguarded URL.
 *
 * `onLog`, when supplied, receives human-readable progress lines (URLs, counts,
 * sizes only — never secrets or page bodies).
 */
export async function collectLabSiteText(
  websiteUrl: string,
  onLog?: (msg: string) => void
): Promise<string> {
  onLog?.(`Fetching ${websiteUrl}`)
  const home = await fetchPageText(websiteUrl)
  if (home.text.length === 0 && home.links.length === 0) {
    return '' // caller maps to "could not fetch"
  }

  let baseDomain: string | null = null
  try {
    baseDomain = registrableDomain(new URL(websiteUrl).hostname)
  } catch {
    baseDomain = null
  }

  // Candidate links: same-registrable-domain, fragment-stripped, deduped, not
  // the homepage itself, capped. This is the ONLY set the model may pick from.
  const seen = new Set<string>()
  const candidateLinks: string[] = []
  for (const link of home.links) {
    if (candidateLinks.length >= MAX_CANDIDATE_LINKS) break
    let linkHost: string
    try {
      linkHost = new URL(link).hostname
    } catch {
      continue
    }
    if (baseDomain && registrableDomain(linkHost) !== baseDomain) continue
    const normalized = link.split('#')[0]
    if (seen.has(normalized) || normalized === websiteUrl) continue
    seen.add(normalized)
    candidateLinks.push(normalized)
  }

  const analysis = await analyzeHomepage({
    homeUrl: websiteUrl,
    homeText: home.text,
    links: candidateLinks,
  })

  // REJECT non-lab sites and manipulation attempts. ScrapeRejectedError carries
  // a user-facing reason that callers surface verbatim.
  if (!analysis.isLabCatalogue) {
    onLog?.('Rejected: not a lab test catalogue')
    throw new ScrapeRejectedError(
      analysis.concern ?? 'This website does not look like a lab test catalogue.'
    )
  }
  if (analysis.concern) {
    onLog?.('Rejected: ' + analysis.concern)
    throw new ScrapeRejectedError('Rejected: ' + analysis.concern)
  }

  onLog?.(`Validated as a lab catalogue (confidence: ${analysis.confidence})`)

  // analysis.catalogueUrls is already a subset of candidateLinks (intersected
  // in parseHomepageAnalysis), so every entry is same-domain. Cap at the safety
  // max and fetch in parallel (bounded), each re-guarded inside fetchPageText.
  const catalogueUrls = analysis.catalogueUrls.slice(0, MAX_SUBPAGES)
  onLog?.(`Following ${catalogueUrls.length} catalogue/category page(s)`)

  const fetched = new Set<string>([websiteUrl])
  const catalogueTexts: string[] = []
  const followLinks = new Set<string>()

  const firstRound = await fetchAllBounded(catalogueUrls, onLog)
  for (const r of firstRound) {
    fetched.add(r.url)
    if (r.text.length > 0) catalogueTexts.push(r.text)
    // Collect same-domain pagination links surfaced by the catalogue pages.
    for (const link of r.links) {
      if (followLinks.size >= MAX_SUBPAGES) break
      const normalized = link.split('#')[0]
      if (fetched.has(normalized) || followLinks.has(normalized)) continue
      let linkHost: string
      try {
        linkHost = new URL(normalized).hostname
      } catch {
        continue
      }
      if (baseDomain && registrableDomain(linkHost) !== baseDomain) continue
      if (!PAGINATION_LINK_RE.test(normalized)) continue
      followLinks.add(normalized)
    }
  }

  // ONE extra bounded round: follow pagination links found above (or implied by
  // analysis.hasPagination), respecting the total MAX_SUBPAGES page budget.
  const remaining = MAX_SUBPAGES - fetched.size + 1 // +1: homepage doesn't count
  if ((analysis.hasPagination || followLinks.size > 0) && remaining > 0) {
    const paginationUrls = Array.from(followLinks).slice(0, Math.max(0, remaining))
    if (paginationUrls.length > 0) {
      onLog?.(`Following ${paginationUrls.length} pagination page(s)`)
      const secondRound = await fetchAllBounded(paginationUrls, onLog)
      for (const r of secondRound) {
        if (r.text.length > 0) catalogueTexts.push(r.text)
      }
    }
  }

  // Catalogue/pagination text goes FIRST so a large homepage can't consume the
  // char budget and truncate away the actual test list; the homepage text
  // follows as filler. Capped at MAX_TOTAL_CHARS.
  const parts =
    catalogueTexts.length > 0 ? [...catalogueTexts, home.text] : [home.text]

  const combined = parts.join('\n\n').slice(0, MAX_TOTAL_CHARS)
  onLog?.(`Collected ${combined.length} characters of catalogue text`)
  return combined
}

/**
 * Fetch `urls` in parallel with bounded concurrency, each re-guarded inside
 * {@link fetchPageText}. Returns one result per URL (in input order); logs a
 * line per successfully-fetched page.
 */
async function fetchAllBounded(
  urls: string[],
  onLog?: (msg: string) => void
): Promise<Array<{ url: string; text: string; links: string[] }>> {
  const results = new Array<{ url: string; text: string; links: string[] }>(
    urls.length
  )
  let nextIdx = 0
  async function worker(): Promise<void> {
    while (nextIdx < urls.length) {
      const i = nextIdx++
      const url = urls[i]
      const page = await fetchPageText(url) // re-guarded inside
      results[i] = { url, text: page.text, links: page.links }
      if (page.text.length > 0) onLog?.(`Fetched ${url}`)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(SUBPAGE_CONCURRENCY, urls.length) }, () =>
      worker()
    )
  )
  return results
}

/** Strip script/style/tags and collapse whitespace to plain text. */
function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Extract anchor hrefs, resolved to absolute URLs against `base`. */
function extractLinks(html: string, base: URL): string[] {
  const links: string[] = []
  const re = /<a\b[^>]*\shref\s*=\s*("([^"]*)"|'([^']*)'|([^\s">]+))/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const raw = match[2] ?? match[3] ?? match[4]
    if (!raw) continue
    const href = raw.trim()
    if (href.length === 0 || href.startsWith('#')) continue
    if (/^(javascript|mailto|tel|data):/i.test(href)) continue
    try {
      links.push(new URL(href, base).toString())
    } catch {
      // skip unparseable hrefs
    }
  }
  return links
}
