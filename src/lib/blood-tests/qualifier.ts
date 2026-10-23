/**
 * A result's comparison qualifier: a lab reports "<0.5" or ">100" when the
 * value is beyond what the assay measures. The number is stored in
 * `test_results.value` and the sign in `test_results.qualifier`, so screens
 * show "<0.5", never a plain 0.5.
 */
export const RESULT_QUALIFIERS = ['<', '<=', '>', '>='] as const
export type ResultQualifier = (typeof RESULT_QUALIFIERS)[number]

/** A qualifier in any common spelling ('≤', '=<', ' < ') → canonical, else null. */
export function normalizeQualifier(raw: unknown): ResultQualifier | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().replace('≤', '<=').replace('≥', '>=').replace('=<', '<=').replace('=>', '>=')
  return (RESULT_QUALIFIERS as readonly string[]).includes(s) ? (s as ResultQualifier) : null
}

/**
 * Parse a typed value such as "4.2", "-1.5", "<0.5", "> 100" or "0,8".
 * Returns null when the text holds no number.
 */
export function parseQualifiedValue(
  raw: string
): { value: number; qualifier: ResultQualifier | null } | null {
  const m = /^\s*(<=|>=|=<|=>|≤|≥|<|>)?\s*([-+]?\d+(?:[.,]\d+)?|[-+]?[.,]\d+)\s*$/.exec(raw)
  if (!m) return null
  const value = Number(m[2].replace(',', '.'))
  if (!Number.isFinite(value)) return null
  return { value, qualifier: normalizeQualifier(m[1] ?? null) }
}

/** The qualifier as shown before a value ('≤' and '≥' for the two-char forms). */
export function qualifierPrefix(q: string | null | undefined): string {
  switch (normalizeQualifier(q)) {
    case '<':
      return '<'
    case '<=':
      return '≤'
    case '>':
      return '>'
    case '>=':
      return '≥'
    default:
      return ''
  }
}

/** A value as text with its qualifier: formatQualified(0.5, '<') → '<0.5'. */
export function formatQualified(
  formatted: string,
  q: string | null | undefined
): string {
  return `${qualifierPrefix(q)}${formatted}`
}
