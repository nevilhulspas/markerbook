import 'server-only'

import { siteUrl } from '@/lib/site-url'

import { guardedFetch, readBounded } from './guarded-fetch'

/** Product token the lab scraper sends and looks for in robots.txt groups. */
export const LAB_BOT_TOKEN = 'MarkerbookLabBot'
export const LAB_BOT_USER_AGENT = `${LAB_BOT_TOKEN}/1.0 (+${siteUrl()})`

const ROBOTS_TIMEOUT_MS = 5_000
const MAX_ROBOTS_BYTES = 500_000

interface Rule {
  allow: boolean
  pattern: string
}

/**
 * The rules that apply to `agent` in a robots.txt body (RFC 9309): the groups
 * whose user-agent line matches the agent's product token, or else the `*`
 * groups. An empty array means everything is allowed.
 */
export function parseRobots(body: string, agent: string = LAB_BOT_TOKEN): Rule[] {
  const token = agent.toLowerCase()
  const specific: Rule[] = []
  const wildcard: Rule[] = []
  let groupAgents: string[] = []
  let inRules = false
  let matchedSpecific = false

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim()
    if (!line) continue
    const sep = line.indexOf(':')
    if (sep === -1) continue
    const key = line.slice(0, sep).trim().toLowerCase()
    const value = line.slice(sep + 1).trim()

    if (key === 'user-agent') {
      // A user-agent line after rules starts a new group.
      if (inRules) {
        groupAgents = []
        inRules = false
      }
      groupAgents.push(value.toLowerCase())
      continue
    }
    if (key !== 'allow' && key !== 'disallow') continue
    inRules = true
    // An empty Disallow allows everything; it adds no rule.
    if (value === '') continue
    const rule = { allow: key === 'allow', pattern: value }
    if (groupAgents.some((a) => a !== '*' && token.includes(a))) {
      matchedSpecific = true
      specific.push(rule)
    } else if (groupAgents.includes('*')) {
      wildcard.push(rule)
    }
  }
  return matchedSpecific ? specific : wildcard
}

function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith('$')
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${body}${anchored ? '$' : ''}`)
}

/**
 * Whether `pathWithQuery` may be fetched under `rules`: the longest matching
 * pattern wins, and on a tie Allow wins (RFC 9309 §2.2.2).
 */
export function isAllowed(rules: Rule[], pathWithQuery: string): boolean {
  let best: Rule | null = null
  for (const rule of rules) {
    if (!patternToRegExp(rule.pattern).test(pathWithQuery)) continue
    if (
      !best ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow && !best.allow)
    ) {
      best = rule
    }
  }
  return best ? best.allow : true
}

// One robots.txt read per origin per server process. A lab scrape fetches up
// to 60 pages of one site, so this keeps it to a single extra request.
const cache = new Map<string, Promise<Rule[] | null>>()

async function loadRules(origin: string): Promise<Rule[] | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ROBOTS_TIMEOUT_MS)
  try {
    // Same SSRF guard on every redirect hop as the page fetches.
    const fetched = await guardedFetch(`${origin}/robots.txt`, {
      signal: controller.signal,
      headers: { 'User-Agent': LAB_BOT_USER_AGENT, Accept: 'text/plain' },
    })
    if (!fetched) return null
    const { res } = fetched
    // RFC 9309 §2.3.1: 4xx means no rules; 5xx means assume a full disallow.
    if (res.status >= 400 && res.status < 500) return []
    if (!res.ok) return null
    const text = res.body ? await readBounded(res.body, MAX_ROBOTS_BYTES) : ''
    return parseRobots(text)
  } catch {
    // Unreachable (or SSRF-blocked) robots.txt is treated like a 5xx.
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Whether the site's robots.txt lets the lab scraper fetch `url`. */
export async function robotsAllows(url: URL): Promise<boolean> {
  let rules = cache.get(url.origin)
  if (!rules) {
    rules = loadRules(url.origin)
    cache.set(url.origin, rules)
  }
  const resolved = await rules
  if (resolved === null) {
    // Do not cache a failure for the whole process: the next scrape retries.
    cache.delete(url.origin)
    return false
  }
  return isAllowed(resolved, `${url.pathname}${url.search}`)
}

/** Test hook. */
export function clearRobotsCache(): void {
  cache.clear()
}
