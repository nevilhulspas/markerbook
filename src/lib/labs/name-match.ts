// Name matching and sample-type narrowing for the lab-test chat tools.
// Pure functions, extracted from lab-test-tools.ts unchanged.

import { normalizeTestKey } from '@/lib/labs/normalize'

/**
 * Unwrap a Supabase `labs(...)` relation: when the FK is a single relation
 * it returns an object; when treated as a join array it returns an array.
 * Returns the first lab object or null.
 */
export function firstLab(
  rel: { name: string } | { name: string }[] | null
): { name: string } | null {
  if (!rel) return null
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

/**
 * Score how well a candidate catalogue name matches a user-typed needle, on
 * the same `normalizeTestKey` collapser used elsewhere ("25(OH)D" ≈ "Vitamin
 * D 25(OH)"). Higher = better; 0 = no match.
 *
 *   1000   exact            ("Total Cholesterol" vs "total cholesterol")
 *   ~800   prefix           ("Vitamin D"          vs "vitamin d 25-oh")
 *   ~400   substring        ("Cholesterol"       vs "Total Cholesterol")
 *
 * Crucially, we DO NOT match needle.includes(haystack) — that's how the AI
 * passing a phrase like "cholesterol and testosterone" used to make every
 * biomarker mentioned in the string flag as a candidate, producing spurious
 * "ambiguous" errors.
 */
export function scoreNameMatch(haystack: string, needle: string): number {
  const nh = normalizeTestKey(haystack)
  const nn = normalizeTestKey(needle)
  if (nh.length === 0 || nn.length === 0) return 0
  if (nh === nn) return 1000
  if (nh.startsWith(nn)) return 800 - (nh.length - nn.length)
  if (nh.includes(nn)) {
    // Ratio of needle to stored length: a near-complete substring scores
    // higher than a one-token fragment.
    const ratio = nn.length / nh.length
    return Math.round(400 * ratio)
  }
  return 0
}

/**
 * Pick the best candidate by name from a list of rows. Returns:
 *   - { unique } when one row dominates (top score ≥ runner-up + 200)
 *     so unambiguous queries don't trip "ambiguous" on near-misses;
 *   - { ambiguous } with up to 5 top candidates otherwise;
 *   - { none } when nothing scored above 0.
 *
 * `getKeys(row)` returns every searchable name for a row (e.g. a biomarker's
 * canonical name + its short_name). Best score across keys wins for that row.
 *
 * `tieBreaker(a, b)` is consulted ONLY when the top candidates have the
 * same primary key (the first entry from `getKeys`) — i.e. they're genuine
 * data-quality duplicates rather than legitimately distinct names. Without
 * it the user sees "ambiguous" with two identical labels, which has no
 * useful resolution. Negative = prefer a, positive = prefer b.
 * Defaults to "prefer the earlier row in the array" so the result stays
 * stable across calls.
 */
export function resolveBestMatch<T>(
  rows: T[],
  needle: string,
  getKeys: (r: T) => string[],
  tieBreaker?: (a: T, b: T) => number
): { unique: T } | { ambiguous: T[] } | { none: true } {
  const scored = rows
    .map((row) => ({
      row,
      score: Math.max(0, ...getKeys(row).map((k) => scoreNameMatch(k, needle))),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return { none: true }
  if (scored.length === 1) return { unique: scored[0].row }
  // Clear-winner threshold: an exact match (1000) decisively beats any
  // substring (≤ 400); a prefix match (~800) likewise wins over substrings.
  if (scored[0].score >= scored[1].score + 200) {
    return { unique: scored[0].row }
  }

  // Defensive duplicate-collapse: when every "ambiguous" candidate shares
  // the same primary key (catalogue duplicate), there's nothing the user
  // can disambiguate. Pick deterministically. The DB partial unique index
  // on lab_tests(lab_id, lower(name)) prevents new duplicates, but this
  // keeps the resolver robust against legacy or pending-status duplicates.
  const topKey = normalizeTestKey(getKeys(scored[0].row)[0] ?? '')
  const sameKey = scored.filter(
    (s) => normalizeTestKey(getKeys(s.row)[0] ?? '') === topKey
  )
  if (sameKey.length === scored.length && topKey.length > 0) {
    const winner = tieBreaker
      ? sameKey.reduce((best, cur) =>
          tieBreaker(best.row, cur.row) <= 0 ? best : cur
        ).row
      : sameKey[0].row
    return { unique: winner }
  }

  return { ambiguous: scored.slice(0, 5).map((s) => s.row) }
}

// ---- sample-type disambiguation ----
//
// The biomarker catalogue distinguishes sample-specific variants by name
// (e.g. "Cortisol" vs "Cortisol (Saliva)", "DHEA-S" vs "DHEA-S (Urine)").
// lab_tests carries this in its own sample_type column (free-text:
// 'blood' | 'Venous blood' | 'Urine' | 'urine (T908)' | 'stool' | …).
// The hint lets the AI narrow the candidate set before scoring so an
// ambiguous-by-name match resolves cleanly when the user said "blood".

export const SAMPLE_TYPES = [
  'blood',
  'serum',
  'plasma',
  'urine',
  'stool',
  'saliva',
  'hair',
] as const
export type SampleTypeHint = (typeof SAMPLE_TYPES)[number]

// Lightweight sample-class detectors. These are intentionally loose — they
// fire on substring tokens like "(Urine)" suffix or "Venous blood" prefix —
// so name/field variants from different scrapers still collapse correctly.
const isUrineSample = (s: string) => /\b(urine|urinary)\b|\(urine\)/i.test(s)
const isStoolSample = (s: string) => /\bstool\b|\bfec(al|es)\b/i.test(s)
const isSalivaSample = (s: string) => /\b(saliva|salivary)\b/i.test(s)
const isHairSample = (s: string) => /\bhair\b/i.test(s)

/**
 * Narrow the candidate set by sample-type intent before scoring. When the
 * filter would empty out the candidates (the user asked for a sample type
 * nothing in the catalogue matches), we return the original rows instead so
 * the resolver can still surface a useful "ambiguous" or "none" result
 * rather than misleading the user with "not_found".
 */
export function preferSampleType<T>(
  rows: T[],
  getText: (r: T) => string,
  sampleType: SampleTypeHint | undefined
): T[] {
  if (!sampleType) return rows
  let preferred: T[]
  if (sampleType === 'blood' || sampleType === 'serum' || sampleType === 'plasma') {
    // Drop any row whose text explicitly tags a non-blood sample.
    preferred = rows.filter((r) => {
      const t = getText(r)
      return (
        !isUrineSample(t) &&
        !isStoolSample(t) &&
        !isSalivaSample(t) &&
        !isHairSample(t)
      )
    })
  } else if (sampleType === 'urine') {
    preferred = rows.filter((r) => isUrineSample(getText(r)))
  } else if (sampleType === 'stool') {
    preferred = rows.filter((r) => isStoolSample(getText(r)))
  } else if (sampleType === 'saliva') {
    preferred = rows.filter((r) => isSalivaSample(getText(r)))
  } else {
    preferred = rows.filter((r) => isHairSample(getText(r)))
  }
  return preferred.length > 0 ? preferred : rows
}
