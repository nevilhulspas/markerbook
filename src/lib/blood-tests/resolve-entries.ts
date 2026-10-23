import { supabaseAdmin } from '@/lib/supabase/admin'
import { commitCapture, commitCustomCapture } from '@/lib/loinc/resolve'
import { normalizeUnit } from '@/lib/grid/unit-conversion'
import type { MarkerEntryValues } from '@/lib/validations/blood-test'
import type { ResultQualifier } from '@/lib/blood-tests/qualifier'

/** A submitted marker entry once it has a catalog biomarker id. */
export interface ResolvedMarker {
  biomarker_id: string
  value: number
  /** '<' / '>' etc., or null for a plain value. */
  qualifier: ResultQualifier | null
  unit: string
}

export interface ResolveEntriesOptions {
  /**
   * Reuse the biomarker id within one save when two entries share a LOINC
   * code, so we don't fire a redundant second commitCapture write. When
   * false, commitCapture runs once per entry, repeated codes included.
   */
  dedupeLoincCodes: boolean
  /** The signed-in user saving the test; recorded on new catalogue rows. */
  createdBy?: string | null
}

/**
 * Resolve each submitted entry to a biomarker id, in input order. Capturable
 * entries (a LOINC code or a custom name, no biomarker id yet) are committed
 * here — the single chokepoint where out-of-catalog markers are written.
 *
 * Captures run one at a time and stop at the first failure, so a caller that
 * resolves before mutating anything leaves the test untouched on error.
 * Entries sharing a custom name (trimmed, case-insensitive) always reuse one
 * biomarker id. New catalogue rows are shared, so the entry's unit and printed
 * range stay on the user's result and are not copied into them.
 */
export async function resolveMarkerEntries(
  entries: MarkerEntryValues[],
  options: ResolveEntriesOptions
): Promise<
  { markers: ResolvedMarker[]; error: null } | { markers: null; error: string }
> {
  const resolved: ResolvedMarker[] = []
  const capturedByCode = new Map<string, string>()
  // Reuse the biomarker id within one save when two entries share a custom name.
  const capturedByName = new Map<string, string>()
  for (const marker of entries) {
    if (marker.biomarker_id) {
      resolved.push({ biomarker_id: marker.biomarker_id, value: marker.value, qualifier: marker.qualifier ?? null, unit: marker.unit })
    } else if (marker.capture_loinc_code) {
      let biomarkerId = options.dedupeLoincCodes
        ? capturedByCode.get(marker.capture_loinc_code)
        : undefined
      if (!biomarkerId) {
        try {
          biomarkerId = await commitCapture(
            marker.capture_loinc_code,
            { name: marker.name, unit: marker.unit },
            { db: supabaseAdmin, createdBy: options.createdBy },
          )
        } catch (err) {
          return {
            markers: null,
            error: `Failed to create catalog entry for LOINC ${marker.capture_loinc_code}: ${err instanceof Error ? err.message : String(err)}`,
          }
        }
        if (options.dedupeLoincCodes) capturedByCode.set(marker.capture_loinc_code, biomarkerId)
      }
      resolved.push({ biomarker_id: biomarkerId, value: marker.value, qualifier: marker.qualifier ?? null, unit: marker.unit })
    } else if (marker.capture_custom) {
      // name is required for custom entries (schema-enforced).
      const key = marker.name!.trim().toLowerCase()
      let biomarkerId = capturedByName.get(key)
      if (!biomarkerId) {
        try {
          biomarkerId = await commitCustomCapture(
            { name: marker.name!, unit: marker.unit },
            { db: supabaseAdmin, createdBy: options.createdBy },
          )
        } catch (err) {
          return {
            markers: null,
            error: `Failed to create custom marker "${marker.name}": ${err instanceof Error ? err.message : String(err)}`,
          }
        }
        capturedByName.set(key, biomarkerId)
      }
      resolved.push({ biomarker_id: biomarkerId, value: marker.value, qualifier: marker.qualifier ?? null, unit: marker.unit })
    }
    // entries with none of biomarker_id / capture_loinc_code / capture_custom are rejected by the schema refine
  }
  return { markers: resolved, error: null }
}

/**
 * The canonical biomarker_units spellings per biomarker id. A failed read
 * yields an empty map, so units are then written as submitted.
 */
export async function fetchCanonicalUnits(
  biomarkerIds: string[]
): Promise<Map<string, string[]>> {
  const { data: bmUnits, error } = await supabaseAdmin
    .from('biomarker_units')
    .select('biomarker_id, unit')
    .in('biomarker_id', biomarkerIds)

  // Deliberately not fatal: this lookup only fixes a unit's spelling, and in
  // updateBloodTest it runs after the old results were deleted — failing the
  // save here would leave the test empty. Log it and keep the submitted units.
  if (error) {
    console.error('fetchCanonicalUnits: biomarker_units read failed, keeping submitted units:', error.message)
  }

  const canonicalUnits = new Map<string, string[]>()
  for (const u of bmUnits ?? []) {
    const list = canonicalUnits.get(u.biomarker_id) ?? []
    list.push(u.unit)
    canonicalUnits.set(u.biomarker_id, list)
  }
  return canonicalUnits
}

/** The canonical spelling of `unit` for this biomarker, or `unit` unchanged. */
export function toCanonicalUnit(
  canonicalUnits: Map<string, string[]>,
  biomarkerId: string,
  unit: string
): string {
  const available = canonicalUnits.get(biomarkerId) ?? []
  const canonical = available.find(
    (u) => normalizeUnit(u) === normalizeUnit(unit)
  )
  return canonical ?? unit
}

/**
 * One test_results row per resolved marker, in order, with units normalized
 * to match canonical spellings in biomarker_units.
 */
export async function buildResultRows(
  bloodTestId: string,
  markers: ResolvedMarker[]
): Promise<
  Array<{ blood_test_id: string; biomarker_id: string; value: number; qualifier: ResultQualifier | null; unit: string }>
> {
  const canonicalUnits = await fetchCanonicalUnits(markers.map((m) => m.biomarker_id))
  return markers.map((marker) => ({
    blood_test_id: bloodTestId,
    biomarker_id: marker.biomarker_id,
    value: marker.value,
    qualifier: marker.qualifier,
    unit: toCanonicalUnit(canonicalUnits, marker.biomarker_id, marker.unit),
  }))
}
