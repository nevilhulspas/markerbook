import type Anthropic from '@anthropic-ai/sdk'
import { FAST_MODEL, FAST_THINKING } from '@/lib/ai/models'
import { convertUnit } from '@/lib/units/convert'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RangeSource = 'curated' | 'report' | 'ai_estimated'

export interface ResolvedRange {
  low: number | null
  high: number | null
  lowMale?: number | null
  highMale?: number | null
  lowFemale?: number | null
  highFemale?: number | null
  source: RangeSource
}

// ---------------------------------------------------------------------------
// rangeFromReport
// ---------------------------------------------------------------------------

/**
 * Pure: extract a printed range from the report marker.
 * Returns source 'report' when at least one of ref_range_low / ref_range_high
 * is a finite number; else null.
 */
export function rangeFromReport(m: {
  ref_range_low?: number | null
  ref_range_high?: number | null
}): ResolvedRange | null {
  const low = m.ref_range_low ?? null
  const high = m.ref_range_high ?? null

  if (typeof low !== 'number' && typeof high !== 'number') return null

  return { low, high, source: 'report' }
}

// ---------------------------------------------------------------------------
// estimateRange
// ---------------------------------------------------------------------------

const MODEL = FAST_MODEL

const RANGE_SYSTEM_PROMPT = `You are a clinical reference-range specialist. Given a LOINC analyte, return the typical healthy adult reference range in the exact unit provided.

Rules:
- Return STRICT JSON only: {"low":<number|null>,"high":<number|null>,"low_male":<number|null>,"high_male":<number|null>,"low_female":<number|null>,"high_female":<number|null>,"usual_unit":<string|null>,"usual_low":<number|null>,"usual_high":<number|null>}
- Every value MUST be a JSON number or null — never a string, never "N/A".
- Use null for any value you do NOT know or that is not applicable.
- low/high: the range to use when the person's sex is unknown. Fill it whenever you know any range for this analyte, also when you fill the sex-specific values.
- low_male/high_male/low_female/high_female: fill ONLY when the analyte is meaningfully sex-specific (e.g. ferritin, hemoglobin, testosterone, hematocrit, creatinine). For most analytes these should be null.
- usual_unit/usual_low/usual_high: the same healthy adult range in the unit labs most often report this analyte in (it may differ from the requested unit). This is used to check the unit conversion, so convert carefully between the two.
- Do NOT fabricate ranges. If you do not have confident knowledge of a normal range for this analyte in this exact unit, return null for both low and high.
- No prose, no markdown fences, no extra keys — just the JSON object.`

/** Narrowing guard: a value is usable as a numeric column only if it's a finite
 *  number or explicit null. Rejects strings, NaN, Infinity, objects, etc. */
function isFiniteNumberOrNull(v: unknown): v is number | null {
  return v === null || (typeof v === 'number' && Number.isFinite(v))
}

/** Coerce a sex-specific bound to a finite number, else null (never fails). */
function toFiniteOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function parseRangeJson(text: string): Record<string, unknown> | null {
  // Try to find a JSON object in the response
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return null

  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

/** Largest ratio between a bound and its cross-check before we distrust it. */
const SANITY_MAX_RATIO = 2

function disagrees(a: number | null, b: number | null): boolean {
  // A zero lower bound says little about scale; only non-zero bounds compare.
  if (a === null || b === null || a === 0 || b === 0) return false
  const ratio = Math.abs(a / b)
  return ratio > SANITY_MAX_RATIO || ratio < 1 / SANITY_MAX_RATIO
}

/**
 * Sanity check: compare the range in the requested unit with the model's
 * range in the unit labs usually report, converted by our own unit code. A
 * model that knows "MMA 0–0.4 µmol/L" can still write 0–0.4 when asked for
 * nmol/L (a 1000× error; prod had this for Methylmalonate and Ceruloplasmin).
 * When the two disagree by more than {@link SANITY_MAX_RATIO}×, the converted
 * usual range wins and the sex-specific bounds (same error, no cross-check)
 * are dropped. When the usual unit cannot be converted, the range is kept.
 */
export function checkRangeAgainstUsualUnit(
  range: ResolvedRange,
  raw: Record<string, unknown>,
  unit: string,
): ResolvedRange {
  const usualUnit = typeof raw.usual_unit === 'string' ? raw.usual_unit.trim() : ''
  if (!usualUnit) return range
  const usualLow = toFiniteOrNull(raw.usual_low)
  const usualHigh = toFiniteOrNull(raw.usual_high)
  if (usualLow === null && usualHigh === null) return range

  const conv = (v: number | null) => (v === null ? null : convertUnit(v, usualUnit, unit))
  const low = conv(usualLow)
  const high = conv(usualHigh)
  // Not convertible (another kind of unit, no molar mass here): no check.
  if ((usualLow !== null && low === null) || (usualHigh !== null && high === null)) return range

  if (!disagrees(range.low, low) && !disagrees(range.high, high)) return range
  return {
    low: low !== null ? Number(low.toPrecision(4)) : null,
    high: high !== null ? Number(high.toPrecision(4)) : null,
    lowMale: null,
    highMale: null,
    lowFemale: null,
    highFemale: null,
    source: range.source,
  }
}

/**
 * The model's JSON as a ResolvedRange, or null. low/high must each be a finite
 * number or null — anything else rejects the whole range (a stray string or
 * Infinity would crash the numeric insert). Sex-specific bounds are coerced to
 * null instead. When the model fills only the sex-specific bounds (Haiku 5.5
 * does this for e.g. ferritin), the overall range spans both sexes — but only
 * when BOTH sexes have BOTH bounds: a one-sex range must never become the
 * reference for the other sex. Then the range is cross-checked against the
 * model's usual-unit range ({@link checkRangeAgainstUsualUnit}).
 */
function toEstimatedRange(
  raw: Record<string, unknown> | null,
  unit: string,
): ResolvedRange | null {
  if (!raw) return null
  if (!isFiniteNumberOrNull(raw.low) || !isFiniteNumberOrNull(raw.high)) return null

  const lowMale = toFiniteOrNull(raw.low_male)
  const highMale = toFiniteOrNull(raw.high_male)
  const lowFemale = toFiniteOrNull(raw.low_female)
  const highFemale = toFiniteOrNull(raw.high_female)

  let low = raw.low
  let high = raw.high
  if (
    low === null &&
    high === null &&
    lowMale !== null &&
    highMale !== null &&
    lowFemale !== null &&
    highFemale !== null
  ) {
    low = Math.min(lowMale, lowFemale)
    high = Math.max(highMale, highFemale)
  }
  // Require at least one usable overall bound.
  if (low === null && high === null) return null

  return checkRangeAgainstUsualUnit(
    { low, high, lowMale, highMale, lowFemale, highFemale, source: 'ai_estimated' },
    raw,
    unit,
  )
}

/**
 * Haiku estimate for ONE LOINC code; returns source 'ai_estimated',
 * or null if the model can't give a confident range.
 */
export async function estimateRange(
  code: string,
  component: string,
  unit: string,
  ai: Anthropic,
): Promise<ResolvedRange | null> {
  const userContent = `LOINC code: ${code}
Analyte (component): ${component}
Unit: ${unit}

Provide the typical healthy adult reference range for this analyte in ${unit}.`

  let resp: Awaited<ReturnType<typeof ai.messages.create>>
  try {
    resp = await ai.messages.create({
      model: MODEL,
      thinking: FAST_THINKING,
      max_tokens: 256,
      system: RANGE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })
  } catch {
    return null
  }

  const textBlock = resp.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') return null

  return toEstimatedRange(parseRangeJson(textBlock.text), unit)
}

/**
 * Haiku estimate for a marker identified only by NAME (no LOINC code). Used by
 * the custom-capture path for markers that never resolved to a LOINC term, so
 * they still get a reasonable reference band. Same strict-JSON contract and
 * validation as {@link estimateRange}; returns null when the model isn't
 * confident (a common, acceptable outcome — the marker is saved range-less).
 */
export async function estimateRangeByName(
  name: string,
  unit: string,
  ai: Anthropic,
): Promise<ResolvedRange | null> {
  const userContent = `Analyte: ${name}
Unit: ${unit}

Provide the typical healthy adult reference range for this analyte in ${unit}.`

  let resp: Awaited<ReturnType<typeof ai.messages.create>>
  try {
    resp = await ai.messages.create({
      model: MODEL,
      thinking: FAST_THINKING,
      max_tokens: 256,
      system: RANGE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })
  } catch {
    return null
  }

  const textBlock = resp.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') return null

  return toEstimatedRange(parseRangeJson(textBlock.text), unit)
}
