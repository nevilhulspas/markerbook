import type { OtherTestOutcome } from '@/lib/database.types'

/** Human-readable label for each outcome. */
export const OTHER_OUTCOME_LABELS: Record<OtherTestOutcome, string> = {
  positive: 'Positive',
  negative: 'Negative',
  normal: 'Normal',
  abnormal: 'Abnormal',
  inconclusive: 'Inconclusive',
  not_applicable: 'No clear result',
}

/**
 * Badge variant per outcome. For the kinds of tests in this bucket (SIBO,
 * pathogen, intolerance) a "positive"/"abnormal" result usually means the thing
 * was detected, so it reads as a flag; negative/normal read as neutral.
 */
export const OTHER_OUTCOME_VARIANTS: Record<
  OtherTestOutcome,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  positive: 'destructive',
  abnormal: 'destructive',
  negative: 'secondary',
  normal: 'secondary',
  inconclusive: 'outline',
  not_applicable: 'outline',
}

/** Ordered list of outcomes for the review dropdown. */
export const OTHER_OUTCOME_OPTIONS: OtherTestOutcome[] = [
  'positive',
  'negative',
  'normal',
  'abnormal',
  'inconclusive',
  'not_applicable',
]
