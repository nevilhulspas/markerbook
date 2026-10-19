import type { GridRow } from '@/lib/grid/grid-types'

export interface PhenoAgeInput {
  age: number
  albumin: number // g/dL
  creatinine: number // mg/dL
  glucose: number // mg/dL (fasting)
  crp: number // mg/L (hs-CRP, raw -- function applies ln)
  lymphocytePercent: number // %
  mcv: number // fL
  rdw: number // %
  alkalinePhosphatase: number // U/L
  wbc: number // x10^3/uL
}

export interface PhenoAgeReadiness {
  ready: boolean
  present: string[]
  missing: string[]
  presentCount: number
  totalRequired: number
}

export const PHENOAGE_MARKERS = [
  { catalogName: 'Albumin', key: 'albumin' as const, unit: 'g/dL' },
  { catalogName: 'Creatinine', key: 'creatinine' as const, unit: 'mg/dL' },
  {
    catalogName: 'Glucose (Fasting)',
    key: 'glucose' as const,
    unit: 'mg/dL',
  },
  { catalogName: 'hs-CRP', key: 'crp' as const, unit: 'mg/L' },
  {
    catalogName: 'Lymphocytes',
    key: 'lymphocytePercent' as const,
    unit: '%',
  },
  { catalogName: 'MCV', key: 'mcv' as const, unit: 'fL' },
  { catalogName: 'RDW', key: 'rdw' as const, unit: '%' },
  {
    catalogName: 'ALP',
    key: 'alkalinePhosphatase' as const,
    unit: 'U/L',
  },
  {
    catalogName: 'White Blood Cells',
    key: 'wbc' as const,
    unit: 'x10^3/uL',
  },
] as const

/**
 * Calculate PhenoAge (biological age) using the Levine 2018 algorithm.
 *
 * Coefficients from Levine 2018 Table S8 (Gompertz proportional hazards model
 * fitted on NHANES III mortality data). The original model uses ln(glucose) and
 * ln(CRP in mg/dL). This function accepts CRP in mg/L (standard for hs-CRP)
 * and converts internally.
 *
 * References:
 * - Levine ME et al. "An epigenetic biomarker of aging for lifespan and healthspan."
 *   Aging (Albany NY). 2018;10(4):573-591.
 *
 * @returns Biological age estimate, or NaN if CRP <= 0 (ln guard)
 */
export function calculatePhenoAge(input: PhenoAgeInput): number {
  if (input.crp <= 0) return NaN
  if (input.glucose <= 0) return NaN

  // Convert CRP from mg/L (hs-CRP standard) to mg/dL (NHANES III convention)
  const crpMgDL = input.crp / 10

  // Levine 2018 mortality model coefficients (Table S8)
  // Glucose and CRP are log-transformed per the original model specification
  const xb =
    -19.9067 -
    0.0336 * input.albumin +
    0.0095 * input.creatinine +
    0.1953 * Math.log(input.glucose) +
    0.0954 * Math.log(crpMgDL) -
    0.012 * input.lymphocytePercent +
    0.0268 * input.mcv +
    0.3306 * input.rdw +
    0.00188 * input.alkalinePhosphatase +
    0.0554 * input.wbc +
    0.0804 * input.age

  const gamma = 0.0076927

  // Mortality score from Gompertz distribution
  const mortalityScore =
    1 - Math.exp((-Math.exp(xb) * (Math.exp(120 * gamma) - 1)) / gamma)

  // Convert mortality score back to biological age
  return (
    141.50225 +
    Math.log(-0.00553 * Math.log(1 - mortalityScore)) / 0.090165
  )
}

/**
 * Check if the grid data contains all 9 PhenoAge markers for a given test.
 */
export function checkPhenoAgeReadiness(
  rows: GridRow[],
  testId: string
): PhenoAgeReadiness {
  const present: string[] = []
  const missing: string[] = []

  for (const marker of PHENOAGE_MARKERS) {
    const row = rows.find(
      (r) =>
        r.biomarker.name === marker.catalogName ||
        r.biomarker.short_name === marker.catalogName
    )

    if (row && row.values[testId]?.value != null) {
      present.push(marker.catalogName)
    } else {
      missing.push(marker.catalogName)
    }
  }

  return {
    ready: missing.length === 0,
    present,
    missing,
    presentCount: present.length,
    totalRequired: PHENOAGE_MARKERS.length,
  }
}
