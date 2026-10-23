export interface RatioDefinition {
  name: string
  unit: string
  formula: string
  compute: (
    results: Map<string, number>,
    computed: Map<string, number>
  ) => number | null
  dependsOn?: string[]
}

/**
 * Lookup helper: the sum of a marker over the given timepoints.
 * Results map is keyed by `${biomarkerName}_${timepoint}` for timepoint markers,
 * and by `biomarkerName` for non-timepoint markers. Every timepoint must be
 * present: a "24h" total from three of four samples is too low and looks like
 * a real (low) result, so it is null instead.
 */
export function sumTimepoints(
  results: Map<string, number>,
  biomarkerName: string,
  timepoints: string[]
): number | null {
  let sum = 0
  for (const tp of timepoints) {
    const val = results.get(`${biomarkerName}_${tp}`)
    if (val === undefined) return null
    sum += val
  }
  return sum
}

function safeRatio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null
  const result = numerator / denominator
  if (!Number.isFinite(result)) return null
  return result
}

export const DUTCH_RATIOS: RatioDefinition[] = [
  // 1. 24h sums first (no dependencies)
  {
    name: '24h_free_cortisol',
    unit: 'ng/mg',
    formula: 'Free Cortisol (Urine) waking + morning + afternoon + night',
    compute: (results) =>
      sumTimepoints(results, 'Free Cortisol (Urine)', [
        'waking',
        'morning',
        'afternoon',
        'night',
      ]),
  },
  {
    name: '24h_free_cortisone',
    unit: 'ng/mg',
    formula: 'Free Cortisone (Urine) waking + morning + afternoon + night',
    compute: (results) =>
      sumTimepoints(results, 'Free Cortisone (Urine)', [
        'waking',
        'morning',
        'afternoon',
        'night',
      ]),
  },
  {
    name: 'metabolized_cortisol',
    unit: 'ng/mg',
    formula: 'a-Tetrahydrocortisol + b-Tetrahydrocortisol + b-Tetrahydrocortisone',
    compute: (results) => {
      const aTHF = results.get('a-Tetrahydrocortisol')
      const bTHF = results.get('b-Tetrahydrocortisol')
      const bTHE = results.get('b-Tetrahydrocortisone')
      // All three, or no total: a partial sum understates the result.
      if (aTHF === undefined || bTHF === undefined || bTHE === undefined) return null
      return aTHF + bTHF + bTHE
    },
  },

  // 2. Ratios that depend on computed sums
  {
    name: 'cortisol_clearance_rate',
    unit: 'ratio',
    formula: 'metabolized_cortisol / 24h_free_cortisol',
    dependsOn: ['metabolized_cortisol', '24h_free_cortisol'],
    compute: (_results, computed) =>
      safeRatio(
        computed.get('metabolized_cortisol') ?? null,
        computed.get('24h_free_cortisol') ?? null
      ),
  },
  {
    name: 'cortisol_cortisone_ratio',
    unit: 'ratio',
    formula: '24h_free_cortisol / 24h_free_cortisone',
    dependsOn: ['24h_free_cortisol', '24h_free_cortisone'],
    compute: (_results, computed) =>
      safeRatio(
        computed.get('24h_free_cortisol') ?? null,
        computed.get('24h_free_cortisone') ?? null
      ),
  },

  // 3. Simple ratios from raw markers
  {
    name: '2oh_4oh_e1_ratio',
    unit: 'ratio',
    formula: '2-Hydroxyestrone / 4-Hydroxyestrone',
    compute: (results) =>
      safeRatio(
        results.get('2-Hydroxyestrone') ?? null,
        results.get('4-Hydroxyestrone') ?? null
      ),
  },
  {
    name: '2oh_16oh_e1_ratio',
    unit: 'ratio',
    formula: '2-Hydroxyestrone / 16-Hydroxyestrone',
    compute: (results) =>
      safeRatio(
        results.get('2-Hydroxyestrone') ?? null,
        results.get('16-Hydroxyestrone') ?? null
      ),
  },
  {
    name: 'methylation_activity',
    unit: 'ratio',
    formula: '2-Methoxyestrone / 2-Hydroxyestrone',
    compute: (results) =>
      safeRatio(
        results.get('2-Methoxyestrone') ?? null,
        results.get('2-Hydroxyestrone') ?? null
      ),
  },
  {
    name: '5a_reductase_preference',
    unit: 'ratio',
    formula: 'Androsterone / Etiocholanolone',
    compute: (results) =>
      safeRatio(
        results.get('Androsterone') ?? null,
        results.get('Etiocholanolone') ?? null
      ),
  },
  {
    name: 'progesterone_5a_preference',
    unit: 'ratio',
    formula: 'a-Pregnanediol / (a-Pregnanediol + b-Pregnanediol)',
    compute: (results) => {
      const a = results.get('a-Pregnanediol')
      const b = results.get('b-Pregnanediol')
      if (a === undefined || b === undefined) return null
      return safeRatio(a, a + b)
    },
  },
]

export function computeDutchRatios(
  results: Array<{
    biomarker_name: string
    biomarker_id: string
    value: number
    timepoint: string | null
  }>
): Array<{
  name: string
  value: number
  unit: string
  formula: string
  source_marker_ids: string[]
}> {
  // Build lookup maps
  const valueMap = new Map<string, number>()
  const idMap = new Map<string, string>()

  for (const r of results) {
    if (r.timepoint) {
      valueMap.set(`${r.biomarker_name}_${r.timepoint}`, r.value)
    } else {
      valueMap.set(r.biomarker_name, r.value)
    }
    idMap.set(r.biomarker_name, r.biomarker_id)
  }

  const computedValues = new Map<string, number>()
  const output: Array<{
    name: string
    value: number
    unit: string
    formula: string
    source_marker_ids: string[]
  }> = []

  for (const ratio of DUTCH_RATIOS) {
    // Check dependencies are available
    if (ratio.dependsOn) {
      const missingDep = ratio.dependsOn.some(
        (dep) => !computedValues.has(dep)
      )
      if (missingDep) continue
    }

    const result = ratio.compute(valueMap, computedValues)
    if (result === null || !Number.isFinite(result)) continue

    computedValues.set(ratio.name, result)

    // Collect source marker IDs used in this computation
    const sourceIds = new Set<string>()
    for (const r of results) {
      // Check if this marker's value was used (by checking if it's in the valueMap under any key)
      const key = r.timepoint
        ? `${r.biomarker_name}_${r.timepoint}`
        : r.biomarker_name
      if (valueMap.has(key) && r.biomarker_id) {
        sourceIds.add(r.biomarker_id)
      }
    }

    output.push({
      name: ratio.name,
      value: Math.round(result * 10000) / 10000, // 4 decimal precision
      unit: ratio.unit,
      formula: ratio.formula,
      source_marker_ids: [...sourceIds],
    })
  }

  return output
}
