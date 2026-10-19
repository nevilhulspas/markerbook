import { APP_LOCALE } from '@/lib/locale'

// Formatting + scale helpers for microbiome values.
//
// CFU counts span many orders of magnitude (10^5 … 10^11), so they're shown
// in scientific notation and positioned on a log scale. Percentages and
// other linear units use plain formatting + a linear scale.

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
}

function toSuperscript(n: number): string {
  return String(n)
    .split('')
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join('')
}

export function isLogUnit(unit: string | null): boolean {
  if (!unit) return false
  return /CFU|KVE/i.test(unit)
}

/** Format a value for display, scientific for CFU-like magnitudes. */
export function formatMicrobiomeValue(
  value: number | null,
  unit: string | null,
  rawLabel?: string | null
): string {
  if (value == null) return '—'

  // Qualitative rows (parasites): show the raw label, not the 0/1 number.
  if (unit === 'qual') return rawLabel || (value > 0 ? 'positive' : 'negative')

  if (isLogUnit(unit) || Math.abs(value) >= 1e5) {
    const exp = Math.floor(Math.log10(Math.abs(value)))
    const mantissa = value / 10 ** exp
    const mantissaStr =
      Math.abs(mantissa - Math.round(mantissa)) < 0.05
        ? String(Math.round(mantissa))
        : mantissa.toFixed(1)
    const num = `${mantissaStr} × 10${toSuperscript(exp)}`
    return unit && unit !== 'qual' ? `${num} ${unit}` : num
  }

  const formatted =
    Math.abs(value) < 100 ? String(value) : value.toLocaleString(APP_LOCALE)
  return unit && unit !== 'qual' ? `${formatted} ${unit}` : formatted
}

/** Format a reference bound (or ∞ / 0 sentinels) for the "5 × 10⁹ – ∞" label. */
export function formatRef(
  low: number | null,
  high: number | null,
  unit: string | null
): string | null {
  if (low == null && high == null) return null
  const fmt = (n: number) => formatMicrobiomeValue(n, unit)
  if (low != null && high != null) return `${fmt(low)} – ${fmt(high)}`
  if (low != null) return `≥ ${fmt(low)}`
  return `≤ ${fmt(high!)}`
}

/**
 * Percentage of the relevant reference bound the value represents.
 * - "≥ X" norms (ref_low only): value / ref_low  → "% of the minimum"
 * - "≤ X" norms (ref_high only): value / ref_high → "% of the ceiling"
 * - ranges (both): measured against the bound the value is outside of,
 *   or the nearer bound when in range.
 * Returns null for qualitative rows or rows with no usable reference.
 */
export function refPercent(
  value: number | null,
  refLow: number | null,
  refHigh: number | null,
  unit: string | null
): number | null {
  if (value == null || unit === 'qual') return null
  let bound: number | null = null
  if (refLow != null && refHigh != null) {
    if (value < refLow) bound = refLow
    else if (value > refHigh) bound = refHigh
    else bound = refLow // in range — express vs the lower bound
  } else {
    bound = refLow ?? refHigh
  }
  if (bound == null || bound === 0) return null
  return (value / bound) * 100
}

/** Render a refPercent number compactly: "<1%", "0.4%", "118%", ">999%". */
export function formatPercent(pct: number | null): string {
  if (pct == null) return '—'
  if (pct > 0 && pct < 1) return '<1%'
  if (pct > 999) return '>999%'
  if (pct < 10) return `${pct.toFixed(1)}%`
  return `${Math.round(pct)}%`
}

export type MicrobiomeGrade = 'A' | 'B' | 'C' | 'D' | 'E'

/**
 * A directionally-consistent severity grade where A is always "right where
 * it should be" and E is "far off" — regardless of whether the marker has a
 * floor (≥) or ceiling (≤) norm. Lets you scan a column and instantly see
 * the worst offenders, which the floor/ceiling-relative % can't.
 *
 * Built from an "optimality ratio" r (how favorable vs the relevant bound):
 *   ≥ norm  → r = value / ref_low      (more is better)
 *   ≤ norm  → r = ref_high / value     (more headroom is better)
 *   range   → A when in range, else graded by distance past the broken bound
 */
export function grade(
  value: number | null,
  refLow: number | null,
  refHigh: number | null,
  unit: string | null
): MicrobiomeGrade | null {
  if (value == null || unit === 'qual') return null
  if (refLow == null && refHigh == null) return null

  let r: number
  if (refLow != null && refHigh != null) {
    if (value >= refLow && value <= refHigh) return 'A'
    r = value < refLow ? value / refLow : refHigh / value
  } else if (refLow != null) {
    r = refLow === 0 ? 1 : value / refLow
  } else {
    r = value === 0 ? Infinity : refHigh! / value
  }

  if (r >= 1) return 'A'
  if (r >= 0.7) return 'B'
  if (r >= 0.4) return 'C'
  if (r >= 0.15) return 'D'
  return 'E'
}

export interface BarGeometry {
  /** marker position 0–1 across the track */
  valuePos: number
  /** reference (green) zone start/end as 0–1, or null if no zone */
  refStart: number | null
  refEnd: number | null
  log: boolean
}

/**
 * Compute marker + reference-zone positions for a row's mini bar.
 * Returns null when there's nothing meaningful to plot (qualitative rows,
 * or no value).
 */
export function barGeometry(
  value: number | null,
  refLow: number | null,
  refHigh: number | null,
  unit: string | null
): BarGeometry | null {
  if (value == null || unit === 'qual') return null
  if (refLow == null && refHigh == null) return null

  const log = isLogUnit(unit) || value >= 1e5
  const pts = [value, refLow, refHigh].filter(
    (n): n is number => n != null && (!log || n > 0)
  )
  if (pts.length === 0) return null

  const scale = (n: number) => (log ? Math.log10(n) : n)

  let lo = Math.min(...pts.map(scale))
  let hi = Math.max(...pts.map(scale))
  // Pad the domain so markers/zone edges aren't flush against the ends.
  const pad = (hi - lo || 1) * 0.15 + (log ? 0.5 : 0)
  lo -= pad
  hi += pad
  const span = hi - lo || 1
  const pos = (n: number) => Math.max(0, Math.min(1, (scale(n) - lo) / span))

  return {
    valuePos: pos(value),
    refStart: refLow != null ? pos(refLow) : 0,
    refEnd: refHigh != null ? pos(refHigh) : 1,
    log,
  }
}
