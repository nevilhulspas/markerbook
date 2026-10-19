import type { Biomarker, ReferenceRange, Sex } from '@/lib/database.types'
import { sameUnit } from '@/lib/units/parse'

export type RangeStatus = 'normal' | 'borderline' | 'out-of-range' | 'unknown'

const BORDERLINE_PERCENTAGE = 0.1 // 10% of total range beyond each boundary

export function getRangeStatus(
  value: number,
  biomarker: Biomarker,
  sex?: Sex | null
): RangeStatus {
  // Determine applicable range (sex-specific if available + user has sex set)
  let low = biomarker.ref_range_low
  let high = biomarker.ref_range_high

  if (sex === 'male' && biomarker.ref_range_low_male != null) {
    low = biomarker.ref_range_low_male
    high = biomarker.ref_range_high_male
  } else if (sex === 'female' && biomarker.ref_range_low_female != null) {
    low = biomarker.ref_range_low_female
    high = biomarker.ref_range_high_female
  }

  if (low == null || high == null) return 'unknown'

  const range = high - low
  const borderlineBuffer = range * BORDERLINE_PERCENTAGE

  if (value >= low && value <= high) return 'normal'
  if (value < low - borderlineBuffer || value > high + borderlineBuffer)
    return 'out-of-range'
  return 'borderline'
}

// --- New reference_ranges table-based lookup functions ---

function matchesAge(range: ReferenceRange, age?: number | null): boolean {
  if (age == null) return true // no age to check, any range matches
  if (range.age_min != null && age < range.age_min) return false
  if (range.age_max != null && age > range.age_max) return false
  return true
}

/**
 * Find the best-matching reference range for a given unit, sex, and optional age.
 * Priority: sex-specific > general, age-matching > no-age-filter.
 * @param rangeType - 'normal' (default) or 'optimal' for tighter functional ranges
 */
export function findReferenceRange(
  ranges: ReferenceRange[],
  unit: string,
  sex?: 'male' | 'female' | null,
  age?: number | null,
  rangeType: 'normal' | 'optimal' = 'normal',
  phase?: string | null
): { low: number | null; high: number | null } {
  // Same unit also across spelling and equal-scale prefixes (µg/L = ng/mL).
  const typeRanges = ranges.filter(
    (r) => sameUnit(r.unit, unit) && (r.range_type ?? 'normal') === rangeType
  )

  // No cross-type fallback: a lookup whose type has no ranges for this unit
  // returns null so callers know that type doesn't exist. In particular a
  // NORMAL lookup must never fall back to optimal (functional) ranges — that
  // would classify values against a tighter range and flag healthy results.
  const unitRanges = typeRanges.length > 0 ? typeRanges : []

  if (unitRanges.length === 0) return { low: null, high: null }

  const sexKey = sex === 'male' || sex === 'female' ? sex : null

  function findBest(pool: ReferenceRange[]): ReferenceRange | undefined {
    if (phase) {
      // Phase-aware priority: phase+sex > phase+general
      const phaseMatch =
        (sexKey ? pool.find((r) => r.phase === phase && r.sex === sexKey) : undefined) ??
        pool.find((r) => r.phase === phase && r.sex === 'general')
      if (phaseMatch) return phaseMatch
    }
    // Fall back to phase-agnostic (existing behavior for blood markers)
    if (sexKey) {
      return (
        pool.find((r) => !r.phase && r.sex === sexKey) ??
        pool.find((r) => !r.phase && r.sex === 'general')
      )
    }
    return pool.find((r) => !r.phase && r.sex === 'general')
  }

  const candidates = unitRanges.filter((r) => matchesAge(r, age))
  const fallback = unitRanges

  const match = findBest(candidates) ?? findBest(fallback)

  return {
    low: match?.range_low ?? null,
    high: match?.range_high ?? null,
  }
}

/**
 * Get range status using the new ReferenceRange[] model.
 * Same logic as getRangeStatus but sources ranges from ReferenceRange[]
 * instead of inline Biomarker fields.
 */
export function getRangeStatusFromRanges(
  value: number,
  ranges: ReferenceRange[],
  unit: string,
  sex?: 'male' | 'female' | null,
  age?: number | null,
  phase?: string | null
): RangeStatus {
  const { low, high } = findReferenceRange(ranges, unit, sex, age, 'normal', phase)
  if (low == null || high == null) return 'unknown'

  const range = high - low
  const borderlineBuffer = range * BORDERLINE_PERCENTAGE

  if (value >= low && value <= high) return 'normal'
  if (value < low - borderlineBuffer || value > high + borderlineBuffer)
    return 'out-of-range'
  return 'borderline'
}

export function getStatusColor(status: RangeStatus): string {
  switch (status) {
    case 'normal':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    case 'borderline':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'out-of-range':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    case 'unknown':
      return 'bg-muted text-muted-foreground'
  }
}

export function getStatusLabel(status: RangeStatus): string {
  switch (status) {
    case 'normal':
      return 'Normal'
    case 'borderline':
      return 'Borderline'
    case 'out-of-range':
      return 'Out of Range'
    case 'unknown':
      return 'No Reference'
  }
}
