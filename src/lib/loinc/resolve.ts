import type { TypedSupabaseClient } from '@/lib/supabase/database'
import type Anthropic from '@anthropic-ai/sdk'
import type { Biomarker } from '@/lib/database.types'
import type { BiomarkerToMatch, LoincCandidate, LoincTerm } from './types'
import { groupContainerIds, matchBiomarkers } from '@/lib/extraction/match-biomarkers'
import { rankCandidates } from './score'
import { searchLoinc as defaultSearchLoinc } from './nlm-client'
import { isUniqueViolation } from '@/lib/supabase/errors'
import { estimateRange as defaultEstimateRange } from './ranges'
import type { ResolvedRange } from './ranges'
import type { TableInsert } from '@/lib/supabase/database'
import { getAnthropic } from '@/lib/ai/client'
import { takeAiRequest } from '@/lib/ai/quota'
import {
  cleanCatalogText,
  creatorFields,
  loincUnitToLabUnit,
  rememberCreatorUnit,
  MAX_CATALOG_CATEGORY_LENGTH,
} from '@/lib/catalog/shared-catalog'

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
  /** The signed-in user who triggered the write: recorded as `created_by` and
   *  given their own unit as display preference. */
  createdBy?: string | null
}

/**
 * Deps for `commitCustomCapture`. No AI: a custom row has no trusted source for
 * a unit or range, so it gets neither.
 */
export interface CommitCustomCaptureDeps {
  db: TypedSupabaseClient
  /** See CommitCaptureDeps.createdBy. */
  createdBy?: string | null
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

/**
 * The catalogue row that owns a LOINC code, never a group container. A
 * container (a row other rows use as parent) only groups its variants and is
 * not a measurement, so when it owns the code its "total" variant is used, and
 * with no total variant there is no match.
 */
function findByLoincCode(catalog: Biomarker[], code: string): Biomarker | undefined {
  const containers = groupContainerIds(catalog)
  const owner = catalog.find((b) => b.loinc_code === code)
  if (!owner) return undefined
  if (!containers.has(owner.id)) return owner
  return catalog.find((b) => b.parent_id === owner.id && b.variant_name === 'total')
}

/** True when a group container owns the code (so a new capture must not be made for it). */
function isContainerCode(catalog: Biomarker[], code: string): boolean {
  const containers = groupContainerIds(catalog)
  return catalog.some((b) => b.loinc_code === code && containers.has(b.id))
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
      const existing = findByLoincCode(catalog, marker.loinc_code)
      if (existing) {
        return { status: 'matched', biomarkerId: existing.id, via: 'ai_code' }
      }
      // A group container owns it: a capture would hit the unique code index
      // and land on the container, so leave the marker unresolved.
      if (isContainerCode(catalog, marker.loinc_code)) {
        return { status: 'unresolved', name: marker.name }
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
  const existingByCode = findByLoincCode(catalog, top.code)
  if (existingByCode) {
    return { status: 'matched', biomarkerId: existingByCode.id, via: 'fallback' }
  }
  if (isContainerCode(catalog, top.code)) {
    return { status: 'unresolved', name: marker.name }
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
 * The row is shared by every user, so it is built from LOINC data only: name,
 * category and unit come from the LOINC term, and the reference range is an
 * estimate for that code in that unit. The caller's name, unit and printed
 * range are never copied into it; the user's unit stays on their own result
 * and becomes their display preference (`deps.createdBy`).
 *
 * Must be called with a service-role client (`deps.db`).
 */
export async function commitCapture(
  loincCode: string,
  marker: {
    /** The lab's raw marker name. Not stored on the shared row. */
    name?: string
    /** The unit of the user's result. Not stored on the shared row. */
    unit: string
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

  // Display name precedence: LOINC clean_name → LOINC long common name → the
  // LOINC component. Never the lab's raw name (a later import of that spelling
  // still finds this row by its LOINC code) and never the unit.
  const cleanName =
    cleanCatalogText(displayRow?.clean_name as string | null) ??
    cleanCatalogText(termRow.long_common_name as string | null) ??
    cleanCatalogText(termRow.component as string | null) ??
    loincCode
  const abbreviation = cleanCatalogText(displayRow?.abbreviation as string | null, 40)
  const category =
    cleanCatalogText(termRow.class as string | null, MAX_CATALOG_CATEGORY_LENGTH) ?? 'Other'
  const component = (termRow.component as string | null) ?? cleanName
  // LOINC's example unit in lab spelling; '' when LOINC has none (the row then
  // has no catalogue unit and every user sees their own).
  const unit = loincUnitToLabUnit(termRow.example_ucum_units as string | null) ?? ''

  // Reference range: an estimate for this LOINC code in the catalogue unit.
  // Without a unit there is nothing to anchor a range to.
  // The estimate is a model call of its own: it counts against the limit of
  // the user whose save triggered it, and is skipped (no range) over it.
  let resolvedRange: ResolvedRange | null = null
  if (unit && (!deps.createdBy || (await takeAiRequest(deps.createdBy)).ok)) {
    const estimateFn = deps.estimateRange ?? defaultEstimateRange
    const ai = deps.ai ?? getDefaultAiClient()
    resolvedRange = await estimateFn(loincCode, component, unit, ai)
  }

  const row: TableInsert<'biomarkers'> = {
    name: cleanName,
    short_name: abbreviation,
    unit,
    aliases: [],
    category,
    loinc_code: loincCode,
    ...(await creatorFields(db, deps.createdBy)),
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
    await rememberCreatorUnit(db, deps.createdBy, inserted.id, marker.unit, unit)
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
 * `is_custom: true` and the lab's own (cleaned) name and category.
 *
 * Nothing trusted says which unit or range such a marker has, so the shared
 * row gets neither: no catalogue unit ('') and no reference range. The
 * creator's unit becomes their own display preference (`deps.createdBy`).
 *
 * Identity is the biomarker NAME (globally UNIQUE), so on a unique-violation it
 * re-selects the existing live row — two imports of "AA/EPA" converge on one
 * catalog entry, which is left unchanged. Must be called with a service-role
 * client (`deps.db`).
 */
export async function commitCustomCapture(
  marker: {
    name: string
    /** The unit of the user's result. Not stored on the shared row. */
    unit: string
    /** Catalog category; defaults to 'Other' when the caller has none. */
    category?: string | null
  },
  deps: CommitCustomCaptureDeps,
): Promise<string> {
  const { db } = deps
  const name = cleanCatalogText(marker.name)
  if (!name) throw new Error('commitCustomCapture: marker name is required')

  const row: TableInsert<'biomarkers'> = {
    name,
    unit: '',
    category: cleanCatalogText(marker.category, MAX_CATALOG_CATEGORY_LENGTH) ?? 'Other',
    aliases: [],
    loinc_code: null,
    is_custom: true,
    ...(await creatorFields(db, deps.createdBy)),
  }

  const { data: inserted, error: insertError } = await db
    .from('biomarkers')
    .insert(row)
    .select()
    .single()

  if (!insertError && inserted) {
    await rememberCreatorUnit(db, deps.createdBy, inserted.id, marker.unit, '')
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
