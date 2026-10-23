import type { GridRow } from '@/lib/grid/grid-types'

export interface PhenoAgeInput {
  age: number
  albumin: number // g/L
  creatinine: number // µmol/L
  glucose: number // mmol/L (fasting)
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

/**
 * The nine PhenoAge inputs. Rows are found by LOINC code first (codes in
 * order of preference), because catalogue names drift: prod results for RDW
 * live on 'RDW-CV', and the 'RDW' row is archived. `catalogName` is the label
 * the card shows and the last-resort name match for rows without a code.
 */
export const PHENOAGE_MARKERS = [
  {
    catalogName: 'Albumin',
    key: 'albumin' as const,
    unit: 'g/L',
    loincCodes: ['1751-7', '61151-7', '61152-5'],
  },
  {
    catalogName: 'Creatinine',
    key: 'creatinine' as const,
    unit: 'umol/L',
    loincCodes: ['2160-0', '38483-4', '14682-9'],
  },
  {
    catalogName: 'Glucose (Fasting)',
    key: 'glucose' as const,
    unit: 'mmol/L',
    loincCodes: ['1558-6', '14771-0', '2345-7'],
  },
  {
    catalogName: 'hs-CRP',
    key: 'crp' as const,
    unit: 'mg/L',
    loincCodes: ['30522-7', '1988-5'],
  },
  {
    catalogName: 'Lymphocytes',
    key: 'lymphocytePercent' as const,
    unit: '%',
    loincCodes: ['26478-8', '736-9'],
  },
  {
    catalogName: 'MCV',
    key: 'mcv' as const,
    unit: 'fL',
    loincCodes: ['787-2', '30428-7'],
  },
  {
    catalogName: 'RDW',
    key: 'rdw' as const,
    unit: '%',
    loincCodes: ['788-0', '30385-9'],
  },
  {
    catalogName: 'ALP',
    key: 'alkalinePhosphatase' as const,
    unit: 'U/L',
    loincCodes: ['6768-6'],
  },
  {
    catalogName: 'White Blood Cells',
    key: 'wbc' as const,
    unit: 'x10^3/uL',
    loincCodes: ['26464-8', '6690-2', '33256-9'],
  },
] as const

export type PhenoAgeMarker = (typeof PHENOAGE_MARKERS)[number]

/**
 * Find the grid row that holds a value for `marker` in test `testId`: the
 * first LOINC code (in preference order) with a value wins, then a name or
 * short-name match. Rows without a value in that test are skipped, so an empty
 * duplicate row never hides the one that has the result.
 */
export function findPhenoAgeRow(
  rows: GridRow[],
  marker: PhenoAgeMarker,
  testId: string
): GridRow | undefined {
  const hasValue = (r: GridRow) => r.values[testId]?.value != null
  for (const code of marker.loincCodes) {
    const row = rows.find((r) => r.biomarker.loinc_code === code && hasValue(r))
    if (row) return row
  }
  return rows.find(
    (r) =>
      hasValue(r) &&
      (r.biomarker.name === marker.catalogName ||
        r.biomarker.short_name === marker.catalogName)
  )
}

/**
 * Calculate PhenoAge (biological age) using the Levine 2018 algorithm.
 *
 * Coefficients and units from Levine 2018, Supplementary Table S1 (Gompertz
 * proportional hazards model fitted on NHANES III mortality data): albumin in
 * g/L, creatinine in µmol/L, glucose in mmol/L (not log-transformed), CRP as
 * ln(mg/dL). This function takes CRP in mg/L (standard for hs-CRP) and
 * converts it. The callers convert the other markers to these units first.
 *
 * References:
 * - Levine ME et al. "An epigenetic biomarker of aging for lifespan and healthspan."
 *   Aging (Albany NY). 2018;10(4):573-591. Supplement Table S1.
 * - Liu Z et al. 2018/2019 (PLoS Med), same model on NHANES IV.
 *
 * @returns Biological age estimate, or NaN if CRP <= 0 (ln guard)
 */
export function calculatePhenoAge(input: PhenoAgeInput): number {
  if (input.crp <= 0) return NaN
  if (input.glucose <= 0) return NaN

  // Convert CRP from mg/L (hs-CRP standard) to mg/dL (NHANES III convention)
  const crpMgDL = input.crp / 10

  // Levine 2018 mortality model coefficients (Table S1). Only CRP is
  // log-transformed.
  const xb =
    -19.9067 -
    0.0336 * input.albumin +
    0.0095 * input.creatinine +
    0.1953 * input.glucose +
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
 * Whole years between a date of birth and `onDate`, both 'YYYY-MM-DD' (a
 * longer ISO string is cut to its date part). PhenoAge must use the age on the
 * test date, not today's age: an old test would otherwise look biologically
 * younger every year. Returns null for an unparseable date.
 */
export function ageOnDate(dateOfBirth: string, onDate: string): number | null {
  const parse = (d: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
    return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null
  }
  const dob = parse(dateOfBirth)
  const at = parse(onDate)
  if (!dob || !at) return null
  let age = at.y - dob.y
  if (at.m < dob.m || (at.m === dob.m && at.d < dob.d)) age--
  return age
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
    if (findPhenoAgeRow(rows, marker, testId)) {
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
