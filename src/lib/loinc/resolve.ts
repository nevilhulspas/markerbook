import type { TypedSupabaseClient } from '@/lib/supabase/database'
import type Anthropic from '@anthropic-ai/sdk'
import type { Biomarker } from '@/lib/database.types'
import type { BiomarkerToMatch, LoincCandidate, LoincTerm } from './types'
import { matchBiomarkers } from '@/lib/extraction/match-biomarkers'
import { rankCandidates } from './score'
import { searchLoinc as defaultSearchLoinc } from './nlm-client'
import { isUniqueViolation } from '@/lib/supabase/errors'
import {
  rangeFromReport,
  estimateRange as defaultEstimateRange,
  estimateRangeByName as defaultEstimateRangeByName,
} from './ranges'
import type { ResolvedRange } from './ranges'
import type { TableInsert } from '@/lib/supabase/database'
import { getAnthropic } from '@/lib/ai/client'

// The named column list for `loinc_terms` reads — mirrors the explicit-columns
// style in display.ts. `class` is included because capture uses it for category.
const LOINC_TERMS_COLUMNS =
  'loinc_num, component, property, system, scale_typ, method_typ, long_common_name, short_name, example_ucum_units, classtype, status, class'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ReportMarker {
  name: string
  unit: string
  loinc_code?: string | null
  ref_range_low?: number | null
  ref_range_high?: number | null
}

/**
 * The read-only outcome from `resolveMarker`.
 *
 * - `matched`    — biomarker already exists in catalog (no write needed)
 * - `capturable` — resolved to a new lab-active LOINC code; NO write performed.
 *                  Call `commitCapture` at save time to create the biomarker.
 * - `unresolved` — could not find a confident LOINC match
 */
export type ResolveOutcome =
  | { status: 'matched'; biomarkerId: string; via: 'existing' | 'ai_code' | 'fallback' }
  | { status: 'capturable'; loincCode: string; cleanName: string }
  | { status: 'unresolved'; name: string }

/**
 * Deps for the READ-ONLY resolver. No AI client — range estimation happens
 * only at save time inside `commitCapture`.
 */
export interface ResolveDeps {
  db: TypedSupabaseClient
  searchLoinc?: typeof defaultSearchLoinc
}

/**
 * Deps for `commitCapture` (the write path). Requires a service-role client.
 * AI/estimateRange are optional — defaults are used when omitted.
 */
export interface CommitCaptureDeps {
  db: TypedSupabaseClient
  /** Anthropic client for AI-estimated reference ranges. Optional — defaults to a
   *  client built from ANTHROPIC_API_KEY at first use. */
  ai?: Anthropic
  /** Override the estimateRange function (injectable for tests). */
  estimateRange?: typeof defaultEstimateRange
}

/**
 * Deps for `commitCustomCapture`. Same shape as CommitCaptureDeps but the range
 * estimator is name-based (no LOINC code).
 */
export interface CommitCustomCaptureDeps {
  db: TypedSupabaseClient
  ai?: Anthropic
  /** Override the name-based estimateRange function (injectable for tests). */
  estimateRangeByName?: typeof defaultEstimateRangeByName
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

export const CONFIDENCE_THRESHOLD = 0.6

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toBiomarkerToMatch(marker: ReportMarker): BiomarkerToMatch {
  return {
    id: '',
    name: marker.name,
    shortName: null,
    aliases: [],
    category: '',
    currentUnit: marker.unit,
    userValueCount: 0,
    specimen: /urine/i.test(marker.name) ? 'urine' : 'blood',
  }
}

/**
 * Map a `loinc_terms` DB row to the `LoincTerm` shape the scorer expects.
 */
function rowToLoincTerm(row: Record<string, unknown>): LoincTerm {
  return {
    code: row.loinc_num as string,
    component: (row.component as string) ?? '',
    property: (row.property as string | null) ?? null,
    system: (row.system as string | null) ?? null,
    scaleTyp: (row.scale_typ as string | null) ?? null,
    methodTyp: (row.method_typ as string | null) ?? null,
    longCommonName: (row.long_common_name as string) ?? '',
    shortName: (row.short_name as string | null) ?? null,
    ucumUnit: (row.example_ucum_units as string | null) ?? null,
    classtype: (row.classtype as number | null) ?? null,
    status: (row.status as string | null) ?? null,
  }
}

/**
 * Look up a single LOINC code in `loinc_terms` (must be classtype=1, status=ACTIVE).
 * Returns the LoincTerm or null if not found / not lab-active.
 */
async function fetchLabActiveTerm(
  code: string,
  db: TypedSupabaseClient,
): Promise<LoincTerm | null> {
  const { data, error } = await db
    .from('loinc_terms')
    .select(LOINC_TERMS_COLUMNS)
    .eq('loinc_num', code)
    .eq('classtype', 1)
    .eq('status', 'ACTIVE')

  if (error || !data || data.length === 0) return null
  return rowToLoincTerm(data[0])
}

/**
 * Look up many LOINC codes in `loinc_terms` in one round-trip (lab-active only:
 * classtype=1, status=ACTIVE). Used by the fallback path to validate the NLM
 * candidate set without a per-candidate query.
 */
async function fetchLabActiveTerms(
  codes: string[],
  db: TypedSupabaseClient,
): Promise<LoincTerm[]> {
  if (codes.length === 0) return []
  const { data, error } = await db
    .from('loinc_terms')
    .select(LOINC_TERMS_COLUMNS)
    .in('loinc_num', codes)
    .eq('classtype', 1)
    .eq('status', 'ACTIVE')

  if (error || !data) return []
  return data.map(rowToLoincTerm)
}

// Lazily-created default AI client (avoids constructing it in tests / when not needed)
let _defaultAiClient: Anthropic | null = null
function getDefaultAiClient(): Anthropic {
  if (!_defaultAiClient) _defaultAiClient = getAnthropic()
  return _defaultAiClient
}

// ---------------------------------------------------------------------------
// Main read-only resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a report marker against the existing biomarker catalog WITHOUT
 * performing any writes.
 *
 * Returns:
 *   - `matched`    — a catalog biomarker already covers this marker (use its id)
 *   - `capturable` — a new lab-active LOINC code was found; call `commitCapture`
 *                    at save time to create the biomarker row
 *   - `unresolved` — no confident match; the marker will be skipped at save
 */
export async function resolveMarker(
  marker: ReportMarker,
  catalog: Biomarker[],
  deps: ResolveDeps,
): Promise<ResolveOutcome> {
  const { db, searchLoinc = defaultSearchLoinc } = deps

  // -------------------------------------------------------------------------
  // Step 1: Fast path — match against the existing catalog
  // -------------------------------------------------------------------------
  const fakeExtracted = {
    ...marker,
    value: 0,
    confidence: 'high' as const,
    catalog_match: null,
  }
  const [fastMatch] = matchBiomarkers([fakeExtracted], catalog)
  if (fastMatch?.biomarker_id) {
    return { status: 'matched', biomarkerId: fastMatch.biomarker_id, via: 'existing' }
  }

  // -------------------------------------------------------------------------
  // Step 2: AI-proposed LOINC code
  // -------------------------------------------------------------------------
  if (marker.loinc_code) {
    const term = await fetchLabActiveTerm(marker.loinc_code, db)

    if (term) {
      // Check if an existing catalog biomarker already owns this code
      const existing = catalog.find((b) => b.loinc_code === marker.loinc_code)
      if (existing) {
        return { status: 'matched', biomarkerId: existing.id, via: 'ai_code' }
      }

      // Resolved to a new capturable LOINC code — read the clean name but do NOT write
      const { data: displayRows } = await db
        .from('loinc_display')
        .select('loinc_num, clean_name, abbreviation')
        .eq('loinc_num', marker.loinc_code)

      const displayRow = displayRows?.[0]
      const cleanName = (displayRow?.clean_name as string | null) ?? marker.name

      return { status: 'capturable', loincCode: marker.loinc_code, cleanName }
    }
    // Code not found / not lab-active — fall through to step 3
  }

  // -------------------------------------------------------------------------
  // Step 3: Deterministic fallback via NLM search
  // -------------------------------------------------------------------------
  const candidates: LoincCandidate[] = await searchLoinc(marker.name)

  if (candidates.length === 0) {
    return { status: 'unresolved', name: marker.name }
  }

  // Validate the whole candidate set exists in loinc_terms (lab-active) in ONE
  // round-trip. rankCandidates re-sorts by score, so row order doesn't matter.
  const candidateCodes = candidates.map((c) => c.code)
  const validatedTerms = await fetchLabActiveTerms(candidateCodes, db)

  if (validatedTerms.length === 0) {
    return { status: 'unresolved', name: marker.name }
  }

  const bmToMatch = toBiomarkerToMatch(marker)
  const ranked = rankCandidates(bmToMatch, validatedTerms)
  const top = ranked[0]

  if (!top || top.confidence < CONFIDENCE_THRESHOLD) {
    return { status: 'unresolved', name: marker.name }
  }

  // Check if an existing catalog biomarker already owns this code
  const existingByCode = catalog.find((b) => b.loinc_code === top.code)
  if (existingByCode) {
    return { status: 'matched', biomarkerId: existingByCode.id, via: 'fallback' }
  }

  // Resolved to a new capturable LOINC code — read the clean name but do NOT write
  const { data: displayRows } = await db
    .from('loinc_display')
    .select('loinc_num, clean_name, abbreviation')
    .eq('loinc_num', top.code)

  const displayRow = displayRows?.[0]
  const cleanName = (displayRow?.clean_name as string | null) ?? marker.name

  return { status: 'capturable', loincCode: top.code, cleanName }
}

// ---------------------------------------------------------------------------
// Write path: commit a captured biomarker at save time
// ---------------------------------------------------------------------------

/**
 * Insert a new lightweight biomarker row anchored on a LOINC code.
 * On unique-violation (Postgres code 23505) re-selects the existing row.
 * Returns the biomarker id.
 *
 * Must be called with a service-role client (`deps.db`).
 */
export async function commitCapture(
  loincCode: string,
  marker: {
    /** The lab's raw marker name — stored as an alias when it differs from the
     *  chosen display name, so future imports of the same spelling fast-path match. */
    name?: string
    unit: string
    ref_range_low?: number | null
    ref_range_high?: number | null
  },
  deps: CommitCaptureDeps,
): Promise<string> {
  const { db } = deps

  // Read display info
  const { data: displayRows } = await db
    .from('loinc_display')
    .select('loinc_num, clean_name, abbreviation')
    .eq('loinc_num', loincCode)

  const displayRow = displayRows?.[0]
  // Display name precedence: LOINC clean_name → the lab's raw marker name → 'Unknown'.
  // Never fall back to the unit (that would name a biomarker after its unit).
  const cleanName = (displayRow?.clean_name as string | null) ?? marker.name ?? 'Unknown'
  const abbreviation = (displayRow?.abbreviation as string | null) || null

  // Validate the LOINC code BEFORE any write. `loincCode` comes from the client
  // save payload, so a crafted/buggy payload could pass a code that isn't a
  // real, lab-active term. Inserting it would pollute the GLOBAL biomarkers
  // catalog (no user_id → visible to everyone). Refuse unless the code exists
  // in loinc_terms as a lab term (classtype=1) that is currently ACTIVE.
  const { data: termRows } = await db
    .from('loinc_terms')
    .select(LOINC_TERMS_COLUMNS)
    .eq('loinc_num', loincCode)
    .eq('classtype', 1)
    .eq('status', 'ACTIVE')

  const termRow = termRows?.[0]
  if (!termRow) {
    throw new Error(
      `commitCapture: LOINC code ${loincCode} not found/inactive in loinc_terms — refusing to create catalog entry`,
    )
  }

  const category = (termRow.class as string | null) ?? 'Other'
  const component = (termRow.component as string | null) ?? cleanName

  // ---------------------------------------------------------------------------
  // Determine reference range: report-printed range wins; else AI estimate.
  // ---------------------------------------------------------------------------
  let resolvedRange: ResolvedRange | null = rangeFromReport(marker)

  if (!resolvedRange) {
    const estimateFn = deps.estimateRange ?? defaultEstimateRange
    const ai = deps.ai ?? getDefaultAiClient()
    resolvedRange = await estimateFn(loincCode, component, marker.unit, ai)
  }

  // Build the row to insert. Don't make the row its own alias — only keep the
  // raw lab marker name as an alias when it differs from the chosen display
  // name, so future imports of the same lab spelling fast-path match this row.
  const row: TableInsert<'biomarkers'> = {
    name: cleanName,
    short_name: abbreviation,
    unit: marker.unit,
    aliases: marker.name && marker.name !== cleanName ? [marker.name] : [],
    category,
    loinc_code: loincCode,
  }

  if (resolvedRange) {
    row.ref_range_low = resolvedRange.low
    row.ref_range_high = resolvedRange.high
    if (resolvedRange.lowMale !== undefined) row.ref_range_low_male = resolvedRange.lowMale
    if (resolvedRange.highMale !== undefined) row.ref_range_high_male = resolvedRange.highMale
    if (resolvedRange.lowFemale !== undefined) row.ref_range_low_female = resolvedRange.lowFemale
    if (resolvedRange.highFemale !== undefined) row.ref_range_high_female = resolvedRange.highFemale
    row.range_source = resolvedRange.source
  }

  const { data: inserted, error: insertError } = await db
    .from('biomarkers')
    .insert(row)
    .select()
    .single()

  if (!insertError && inserted) {
    return inserted.id
  }

  // Lost the insert race against the partial UNIQUE index
  // (loinc_code IS NOT NULL AND archived_at IS NULL) — re-select the live row.
  // The `archived_at IS NULL` filter must match the index, else this can return
  // an archived biomarker's id (a dead FK).
  if (isUniqueViolation(insertError)) {
    const { data: existing } = await db
      .from('biomarkers')
      .select('id')
      .eq('loinc_code', loincCode)
      .is('archived_at', null)
      .single()

    if (existing) return existing.id
  }

  throw new Error(`commitCapture failed for code ${loincCode}: ${JSON.stringify(insertError)}`)
}

// ---------------------------------------------------------------------------
// Write path: commit a CUSTOM (non-LOINC) biomarker at save time
// ---------------------------------------------------------------------------

/**
 * Insert a new biomarker that never resolved to a LOINC code — a "custom"
 * catalog entry (specialty analyte, ratio, etc.). Parallels `commitCapture` but
 * skips all LOINC validation/lookup: it writes `loinc_code: null`,
 * `is_custom: true`, uses the lab's own name/category, prefers the printed
 * report range and otherwise asks Haiku for a name-based estimate.
 *
 * Identity is the biomarker NAME (globally UNIQUE), so on a unique-violation it
 * re-selects the existing live row — two imports of "AA/EPA" converge on one
 * catalog entry. Must be called with a service-role client (`deps.db`).
 */
export async function commitCustomCapture(
  marker: {
    name: string
    unit: string
    /** Catalog category; defaults to 'Other' when the caller has none. */
    category?: string | null
    ref_range_low?: number | null
    ref_range_high?: number | null
  },
  deps: CommitCustomCaptureDeps,
): Promise<string> {
  const { db } = deps
  const name = marker.name.trim()
  if (!name) throw new Error('commitCustomCapture: marker name is required')

  // Report-printed range wins; else a name-based AI estimate (may be null — the
  // marker is then saved without a reference band, which is fine).
  let resolvedRange: ResolvedRange | null = rangeFromReport(marker)
  if (!resolvedRange) {
    const estimateFn = deps.estimateRangeByName ?? defaultEstimateRangeByName
    const ai = deps.ai ?? getDefaultAiClient()
    resolvedRange = await estimateFn(name, marker.unit, ai)
  }

  const row: TableInsert<'biomarkers'> = {
    name,
    unit: marker.unit,
    category: marker.category ?? 'Other',
    aliases: [],
    loinc_code: null,
    is_custom: true,
  }

  if (resolvedRange) {
    row.ref_range_low = resolvedRange.low
    row.ref_range_high = resolvedRange.high
    if (resolvedRange.lowMale !== undefined) row.ref_range_low_male = resolvedRange.lowMale
    if (resolvedRange.highMale !== undefined) row.ref_range_high_male = resolvedRange.highMale
    if (resolvedRange.lowFemale !== undefined) row.ref_range_low_female = resolvedRange.lowFemale
    if (resolvedRange.highFemale !== undefined) row.ref_range_high_female = resolvedRange.highFemale
    row.range_source = resolvedRange.source
  }

  const { data: inserted, error: insertError } = await db
    .from('biomarkers')
    .insert(row)
    .select()
    .single()

  if (!insertError && inserted) {
    return inserted.id
  }

  // Lost the race against the partial UNIQUE(name) WHERE archived_at IS NULL
  // (migration 20260707000001) — re-select the live row. The partial index means
  // an archived same-name row does NOT collide (a new live row is created), so a
  // 23505 here implies a live winner; `archived_at IS NULL` returns its id and
  // never a dead FK to an archived row.
  if (isUniqueViolation(insertError)) {
    const { data: existing } = await db
      .from('biomarkers')
      .select('id')
      .eq('name', name)
      .is('archived_at', null)
      .single()

    if (existing) return existing.id
  }

  throw new Error(`commitCustomCapture failed for "${name}": ${JSON.stringify(insertError)}`)
}
