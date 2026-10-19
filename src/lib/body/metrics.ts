/**
 * Pure body-composition unit conversions + derived metrics. No `@/` value
 * imports so a tsx script could reuse it. Internal units everywhere downstream:
 * kg (body weights), g (fat/lean/BMC/VAT), % (fractions), kg/m² (indices).
 */

const LB_TO_G = 453.59237

export function lbsToGrams(lb: number): number {
  return lb * LB_TO_G
}

export function gramsToKg(g: number): number {
  return g / 1000
}

export function kgToGrams(kg: number): number {
  return kg * 1000
}

export interface Delta {
  abs: number | null
  pct: number | null
}

/** Change of `current` vs `previous` (absolute + percent). Null-safe. */
export function trendDelta(current: number | null, previous: number | null): Delta {
  if (current == null || previous == null) return { abs: null, pct: null }
  const abs = current - previous
  return { abs, pct: previous === 0 ? null : (abs / previous) * 100 }
}

/**
 * Fat-free mass index = (lean + bone mineral content) in kg / height_m².
 * Used as a fallback when the report doesn't print FFMI directly.
 */
export function deriveFfmi(
  leanG: number | null,
  bmcG: number | null,
  heightCm: number | null
): number | null {
  if (leanG == null || heightCm == null || heightCm <= 0) return null
  const m = heightCm / 100
  return gramsToKg(leanG + (bmcG ?? 0)) / (m * m)
}
