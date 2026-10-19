import type {
  Biomarker,
  DutchTestResult,
  DutchTimepoint,
  ReferenceRange,
} from '@/lib/database.types'
import { findReferenceRange } from '@/lib/grid/reference-range'

export const TIMEPOINT_ORDER: readonly DutchTimepoint[] = [
  'waking',
  'morning',
  'afternoon',
  'night',
] as const

export const TIMEPOINT_LABELS: Record<DutchTimepoint, string> = {
  waking: 'Waking',
  morning: '+2h',
  afternoon: 'Dinner',
  night: 'Bedtime',
}

/** Declining multipliers for per-timepoint reference approximation */
const TIMEPOINT_MULTIPLIERS: Record<DutchTimepoint, number> = {
  waking: 1.0,
  morning: 0.8,
  afternoon: 0.5,
  night: 0.2,
}

export interface DiurnalPoint {
  timepoint: DutchTimepoint
  label: string
  cortisol: number | null
  cortisone: number | null
  refCortisolLow: number
  refCortisolHigh: number
}

/**
 * Build a 4-element diurnal curve data array from DUTCH test results.
 *
 * Per-timepoint reference ranges use a declining approximation from the
 * general cortisol reference range: waking 100%, morning 80%, afternoon 50%, night 20%.
 */
export function buildDiurnalData(
  results: DutchTestResult[],
  biomarkers: Biomarker[],
  refRanges: ReferenceRange[],
  sex?: 'male' | 'female' | null,
  phase?: string | null
): DiurnalPoint[] {
  const cortisolBiomarker = biomarkers.find(
    (b) => b.name === 'Free Cortisol (Urine)'
  )
  const cortisoneBiomarker = biomarkers.find(
    (b) => b.name === 'Free Cortisone (Urine)'
  )

  // Get general cortisol reference range
  const cortisolRefRanges = cortisolBiomarker
    ? refRanges.filter((r) => r.biomarker_id === cortisolBiomarker.id)
    : []
  const cortisolRef = cortisolRefRanges.length > 0
    ? findReferenceRange(cortisolRefRanges, cortisolBiomarker?.unit ?? 'ng/mg', sex, null, 'normal', phase)
    : { low: null, high: null }

  return TIMEPOINT_ORDER.map((tp) => {
    const cortisolResult = cortisolBiomarker
      ? results.find(
          (r) =>
            r.biomarker_id === cortisolBiomarker.id && r.timepoint === tp
        )
      : undefined

    const cortisoneResult = cortisoneBiomarker
      ? results.find(
          (r) =>
            r.biomarker_id === cortisoneBiomarker.id && r.timepoint === tp
        )
      : undefined

    const multiplier = TIMEPOINT_MULTIPLIERS[tp]

    return {
      timepoint: tp,
      label: TIMEPOINT_LABELS[tp],
      cortisol: cortisolResult?.value ?? null,
      cortisone: cortisoneResult?.value ?? null,
      refCortisolLow: (cortisolRef.low ?? 0) * multiplier,
      refCortisolHigh: (cortisolRef.high ?? 0) * multiplier,
    }
  })
}

/**
 * Calculate Cortisol Awakening Response (CAR) as a percentage change
 * from waking to morning cortisol.
 *
 * Returns null if waking or morning cortisol is missing, or if waking is 0.
 */
export function calculateCAR(
  results: DutchTestResult[],
  cortisolBiomarkerId: string
): number | null {
  const waking = results.find(
    (r) =>
      r.biomarker_id === cortisolBiomarkerId && r.timepoint === 'waking'
  )
  const morning = results.find(
    (r) =>
      r.biomarker_id === cortisolBiomarkerId && r.timepoint === 'morning'
  )

  if (!waking || !morning || waking.value === 0) {
    return null
  }

  const car = ((morning.value - waking.value) / waking.value) * 100
  return Math.round(car * 10) / 10
}
