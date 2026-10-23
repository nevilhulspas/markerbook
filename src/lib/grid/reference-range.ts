import type { Biomarker, ReferenceRange, Sex } from '@/lib/database.types'
import { sameUnit } from '@/lib/units/parse'

export type RangeStatus = 'normal' | 'borderline' | 'out-of-range' | 'unknown'

const BORDERLINE_PERCENTAGE = 0.1 // 10% of total range beyond each boundary
/**
 * Cap on the borderline margin: at most half the bound itself. Without it a
 * wide range swallows real problems — eGFR 90–999 gives a 91-point margin, so
 * an eGFR of 20 would only be "Borderline". Normal ranges (span below five
 * times the bound) are not affected.
 */
const BORDERLINE_BOUND_FRACTION = 0.5
/** Borderline margin of a one-sided range ('< 5'): 10% of its bound. */
const ONE_SIDED_FRACTION = 0.1

/**
 * The inline (biomarker-column) range for a sex. A sex-specific pair applies
 * when either of its bounds is set, so a one-sided male range ('< 5') is used.
 */
export function inlineRange(
  biomarker: Pick<
    Biomarker,
    | 'ref_range_low'
    | 'ref_range_high'
    | 'ref_range_low_male'
    | 'ref_range_high_male'
    | 'ref_range_low_female'
    | 'ref_range_high_female'
  >,
  sex?: Sex | null
): { low: number | null; high: number | null } {
  if (sex === 'male' && (biomarker.ref_range_low_male != null || biomarker.ref_range_high_male != null)) {
    return { low: biomarker.ref_range_low_male, high: biomarker.ref_range_high_male }
  }
  if (sex === 'female' && (biomarker.ref_range_low_female != null || biomarker.ref_range_high_female != null)) {
    return { low: biomarker.ref_range_low_female, high: biomarker.ref_range_high_female }
  }
  return { low: biomarker.ref_range_low, high: biomarker.ref_range_high }
}

/**
 * Classify a value against a range that may be one-sided: '< 5' is stored as
 * low null / high 5, '> 60' as low 60 / high null. The borderline margin is
 * 10% of the span, capped at half the bound; a one-sided range uses 10% of
 * its bound.
 */
export function classifyValue(
  value: number,
  low: number | null | undefined,
  high: number | null | undefined
): RangeStatus {
  const lo = low ?? null
  const hi = high ?? null
  if (lo === null && hi === null) return 'unknown'

  const span = lo !== null && hi !== null ? hi - lo : null
  const margin = (bound: number) =>
    span !== null
      ? Math.min(span * BORDERLINE_PERCENTAGE, Math.abs(bound) * BORDERLINE_BOUND_FRACTION)
      : Math.abs(bound) * ONE_SIDED_FRACTION

  if (lo !== null && value < lo) {
    return value < lo - margin(lo) ? 'out-of-range' : 'borderline'
  }
  if (hi !== null && value > hi) {
    return value > hi + margin(hi) ? 'out-of-range' : 'borderline'
  }
  return 'normal'
}

export function getRangeStatus(
  value: number,
  biomarker: Biomarker,
  sex?: Sex | null
): RangeStatus {
  // Sex-specific range if available + user has sex set
  const { low, high } = inlineRange(biomarker, sex)
  return classifyValue(value, low, high)
}

/**
 * The range rows a screen should use for one biomarker: its `reference_ranges`
 * when it has normal rows, else rows made from the inline biomarker columns
 * (in the catalogue unit). The grid already falls back to the inline columns;
 * screens that only read `reference_ranges` showed "No Reference" for markers
 * captured from a report with only an inline range.
 */
export function rangesWithInline(
  biomarker: Pick<
    Biomarker,
    | 'id'
    | 'unit'
    | 'ref_range_low'
    | 'ref_range_high'
    | 'ref_range_low_male'
    | 'ref_range_high_male'
    | 'ref_range_low_female'
    | 'ref_range_high_female'
  >,
  ranges: ReferenceRange[]
): ReferenceRange[] {
  if (ranges.some((r) => (r.range_type ?? 'normal') === 'normal')) return ranges
  const make = (sex: ReferenceRange['sex'], low: number | null, high: number | null): ReferenceRange[] =>
    low == null && high == null
      ? []
      : [
          {
            id: `inline-${sex}`,
            biomarker_id: biomarker.id,
            unit: biomarker.unit,
            sex,
            age_min: null,
            age_max: null,
            range_low: low,
            range_high: high,
            source: 'inline',
            source_url: null,
            verified_at: null,
            verified_by: null,
            range_type: 'normal',
            phase: null,
            created_at: '',
          },
        ]
  return [
    ...ranges,
    ...make('general', biomarker.ref_range_low, biomarker.ref_range_high),
    ...make('male', biomarker.ref_range_low_male, biomarker.ref_range_high_male),
    ...make('female', biomarker.ref_range_low_female, biomarker.ref_range_high_female),
  ]
}

/** A range as text: '3.5 – 5', '< 5' or '> 60'. */
export function formatRangeBounds(low: number | null, high: number | null): string {
  if (low != null && high != null) return `${low} – ${high}`
  if (high != null) return `< ${high}`
  if (low != null) return `> ${low}`
  return ''
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
  return classifyValue(value, low, high)
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
