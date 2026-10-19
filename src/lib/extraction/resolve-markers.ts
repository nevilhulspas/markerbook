import type { TypedSupabaseClient } from '@/lib/supabase/database'
import type { Biomarker } from '@/lib/database.types'
import type { ExtractedMarker, MatchedMarker } from './types'
import { matchBiomarkers } from './match-biomarkers'
import { resolveMarker } from '@/lib/loinc/resolve'
import { searchLoinc as defaultSearchLoinc } from '@/lib/loinc/nlm-client'

export interface ResolveDeps {
  db: TypedSupabaseClient
  searchLoinc?: typeof defaultSearchLoinc
}

/**
 * Resolve extracted markers against the biomarker catalog — READ-ONLY.
 *
 * 1. Fast path: `matchBiomarkers` resolves everything already in the catalog by
 *    name/alias — no I/O.
 * 2. For each marker that wasn't matched, call `resolveMarker`:
 *    - `matched`    → existing biomarker found via LOINC; mark as matched.
 *    - `capturable` → resolved to a new LOINC code; set `capture_loinc_code`
 *                     and `catalog_name` but do NOT write. The write happens at
 *                     save time in `createBloodTest` via `commitCapture`.
 *    - `unresolved` → no catalog/LOINC match; set `capture_custom` so a custom
 *                     (non-LOINC) biomarker is created at save time. The marker
 *                     name still goes in `unresolved` so callers can report it.
 *
 * Markers are processed sequentially so that if two markers would map to the
 * same new LOINC code, the resolver's own 23505 de-dup handles the race rather
 * than us racing two concurrent inserts ourselves.
 */
export async function resolveExtractedMarkers(
  markers: ExtractedMarker[],
  catalog: Biomarker[],
  deps: ResolveDeps,
): Promise<{ matchedMarkers: MatchedMarker[]; unresolved: string[] }> {
  const matchedMarkers = matchBiomarkers(markers, catalog)
  const unresolved: string[] = []

  for (const m of matchedMarkers) {
    if (m.matched) continue

    let outcome
    try {
      outcome = await resolveMarker(
        {
          name: m.name,
          unit: m.unit,
          loinc_code: m.loinc_code,
          ref_range_low: m.ref_range_low,
          ref_range_high: m.ref_range_high,
        },
        catalog,
        deps,
      )
    } catch (err) {
      // Isolate per-marker failures: an unexpected error (e.g. a DB error) on one
      // marker must not abort the whole parse or lose the other markers.
      console.warn(`resolveExtractedMarkers: failed to resolve "${m.name}":`, err)
      unresolved.push(m.name)
      continue
    }

    if (outcome.status === 'capturable') {
      // Store the proposal — the actual biomarker insert happens at save time
      m.capture_loinc_code = outcome.loincCode
      m.catalog_name = outcome.cleanName
      // matched stays false; biomarker_id stays null
    } else if (outcome.status === 'matched') {
      m.biomarker_id = outcome.biomarkerId
      // Surface the catalog name (the LOINC fallback found an existing biomarker
      // the name-matcher missed) so the UI shows it rather than null.
      m.catalog_name = catalog.find((b) => b.id === outcome.biomarkerId)?.name ?? m.catalog_name
      m.matched = true
    } else {
      // status === 'unresolved' — no catalog/LOINC match. Flag it for custom
      // capture at save time (a non-LOINC biomarker) rather than dropping it.
      // Still report the name so the review UI / caller can surface it.
      m.capture_custom = true
      unresolved.push(m.name)
    }
  }

  return { matchedMarkers, unresolved }
}
