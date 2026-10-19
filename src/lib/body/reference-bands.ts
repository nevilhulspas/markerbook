/**
 * Population reference bands for body-composition metrics. These are general
 * population/clinical references for a healthy-adult context — NOT medical
 * advice or diagnosis. Sources noted per metric. Pure + framework-free.
 *
 * Bone T-score uses WHO categories; body-fat %, FFMI, ALMI use commonly-cited
 * adult ranges; VAT and A/G ratio use coarse risk bands. Age refinement is a
 * future improvement — v1 bands are sex-based.
 */

export type Band = 'excellent' | 'good' | 'fair' | 'needs_focus'
type Direction = 'higher_better' | 'lower_better'

interface BandDef {
  direction: Direction
  // For lower_better: value ≤ excellent → excellent, ≤ good → good, ≤ fair → fair, else needs_focus.
  // For higher_better: value ≥ excellent → excellent, ≥ good → good, ≥ fair → fair, else needs_focus.
  excellent: number
  good: number
  fair: number
}

type Sexed = { male: BandDef; female: BandDef }

// Body-fat % (adult): lower is better toward a healthy floor.
// Male athletic/fit ≤ ~14, fitness ≤ ~18, acceptable ≤ ~25, high > 25.
// Female bands shifted up (essential fat is higher). (ACE general ranges.)
const BODY_FAT_PCT: Sexed = {
  male: { direction: 'lower_better', excellent: 14, good: 18, fair: 25 },
  female: { direction: 'lower_better', excellent: 21, good: 25, fair: 32 },
}

// FFMI (kg/m²): higher is better (muscularity). Male ~19–22 typical-fit.
const FFMI: Sexed = {
  male: { direction: 'higher_better', excellent: 22, good: 19, fair: 17.5 },
  female: { direction: 'higher_better', excellent: 18, good: 15.5, fair: 14 },
}

// ALMI (kg/m²): appendicular lean / height². Sarcopenia cutoffs ~7.0 (M) / 5.5 (F).
const ALMI: Sexed = {
  male: { direction: 'higher_better', excellent: 10.5, good: 8.5, fair: 7.0 },
  female: { direction: 'higher_better', excellent: 8.5, good: 6.5, fair: 5.5 },
}

// Visceral fat mass (g): lower is better. Coarse risk bands.
const VISCERAL_FAT_G: Sexed = {
  male: { direction: 'lower_better', excellent: 300, good: 500, fair: 1000 },
  female: { direction: 'lower_better', excellent: 250, good: 400, fair: 800 },
}

// Bone T-score: WHO — ≥ -1 normal, -1..-2.5 osteopenia, ≤ -2.5 osteoporosis.
const BONE_T_SCORE: Sexed = {
  male: { direction: 'higher_better', excellent: 0, good: -1, fair: -2.5 },
  female: { direction: 'higher_better', excellent: 0, good: -1, fair: -2.5 },
}

// Android/Gynoid ratio: lower is better (less central fat). Informational.
const ANDROID_GYNOID_RATIO: Sexed = {
  male: { direction: 'lower_better', excellent: 0.9, good: 1.0, fair: 1.1 },
  female: { direction: 'lower_better', excellent: 0.8, good: 0.9, fair: 1.0 },
}

const BANDS: Record<string, Sexed> = {
  body_fat_pct: BODY_FAT_PCT,
  ffmi: FFMI,
  almi: ALMI,
  visceral_fat_g: VISCERAL_FAT_G,
  bone_t_score: BONE_T_SCORE,
  android_gynoid_ratio: ANDROID_GYNOID_RATIO,
}

const BAND_LABEL: Record<Band, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  needs_focus: 'Needs focus',
}

function bandFor(def: BandDef, value: number): Band {
  if (def.direction === 'lower_better') {
    if (value <= def.excellent) return 'excellent'
    if (value <= def.good) return 'good'
    if (value <= def.fair) return 'fair'
    return 'needs_focus'
  }
  if (value >= def.excellent) return 'excellent'
  if (value >= def.good) return 'good'
  if (value >= def.fair) return 'fair'
  return 'needs_focus'
}

export interface MetricClassification {
  band: Band | null
  label: string
}

/**
 * Classify a metric value into a reference band. Returns `{ band: null }` for
 * metrics without population bands (e.g. lean/total mass — those are judged
 * against the user's own goal), for unknown metrics, or for a null value.
 */
export function classifyMetric(
  metric: string,
  value: number | null,
  ctx: { sex: 'male' | 'female' | 'other' | null; age?: number | null }
): MetricClassification {
  if (value == null || !Number.isFinite(value)) {
    return { band: null, label: 'No reference range' }
  }
  const sexed = BANDS[metric]
  if (!sexed) return { band: null, label: 'No reference range' }
  // Female bands when known female; male bands as the default otherwise.
  const def = ctx.sex === 'female' ? sexed.female : sexed.male
  const band = bandFor(def, value)
  return { band, label: BAND_LABEL[band] }
}
