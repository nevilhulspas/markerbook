import type Anthropic from '@anthropic-ai/sdk'
import { FAST_MODEL, FAST_THINKING } from '@/lib/ai/models'

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
- Return STRICT JSON only: {"low":<number|null>,"high":<number|null>,"low_male":<number|null>,"high_male":<number|null>,"low_female":<number|null>,"high_female":<number|null>}
- Every value MUST be a JSON number or null — never a string, never "N/A".
- Use null for any value you do NOT know or that is not applicable.
- low/high: the range to use when the person's sex is unknown. Fill it whenever you know any range for this analyte, also when you fill the sex-specific values.
- low_male/high_male/low_female/high_female: fill ONLY when the analyte is meaningfully sex-specific (e.g. ferritin, hemoglobin, testosterone, hematocrit, creatinine). For most analytes these should be null.
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

/**
 * The model's JSON as a ResolvedRange, or null. low/high must each be a finite
 * number or null — anything else rejects the whole range (a stray string or
 * Infinity would crash the numeric insert). Sex-specific bounds are coerced to
 * null instead. When the model fills only the sex-specific bounds (Haiku 5.5
 * does this for e.g. ferritin), the overall range spans both sexes — but only
 * when BOTH sexes have BOTH bounds: a one-sex range must never become the
 * reference for the other sex.
 */
function toEstimatedRange(raw: Record<string, unknown> | null): ResolvedRange | null {
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

  return { low, high, lowMale, highMale, lowFemale, highFemale, source: 'ai_estimated' }
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

  return toEstimatedRange(parseRangeJson(textBlock.text))
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

  return toEstimatedRange(parseRangeJson(textBlock.text))
}
