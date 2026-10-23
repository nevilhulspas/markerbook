import type { MatchedMarker } from '@/lib/extraction/types'
import type { ResultQualifier } from '@/lib/blood-tests/qualifier'

/**
 * A marker entry ready to be passed to `createBloodTest`.
 *
 * Exactly one of `biomarker_id` / `capture_loinc_code` / `capture_custom` is set:
 *   - `biomarker_id`       — existing catalog match
 *   - `capture_loinc_code` — new LOINC code; `createBloodTest` calls
 *                            `commitCapture` to create the biomarker row
 *   - `capture_custom`     — no catalog/LOINC match; `createBloodTest` calls
 *                            `commitCustomCapture` to create a custom biomarker
 *                            keyed on the marker name
 */
export type PreparedMarkerEntry =
  | ({ biomarker_id: string } & PreparedValue)
  | ({ capture_loinc_code: string; name?: string } & PreparedValue)
  | ({ capture_custom: true; name: string } & PreparedValue)

interface PreparedValue {
  value: number
  qualifier?: ResultQualifier | null
  unit: string
  ref_range_low?: number | null
  ref_range_high?: number | null
}

interface PrepareMarkersResult {
  markers: PreparedMarkerEntry[]
  duplicateBiomarkerIds: string[]
  duplicateNames: string[]
}

export function prepareMarkersForSave(
  matchedMarkers: MatchedMarker[]
): PrepareMarkersResult {
  // A marker is saveable if it's selected AND has a biomarker_id (existing),
  // a capture_loinc_code (new LOINC code), or capture_custom (non-LOINC custom
  // biomarker) — all three are written/resolved at save time.
  const selectedMarkers = matchedMarkers.filter(
    (marker) => marker.selected && (marker.biomarker_id || marker.capture_loinc_code || marker.capture_custom)
  )

  // Dedup detection runs over three parallel keyspaces:
  //   - resolved markers, keyed by biomarker_id
  //   - capturable markers, keyed by capture_loinc_code (two entries with the
  //     SAME code resolve to one catalog row and collide server-side)
  //   - custom markers, keyed by lowercased name (commitCustomCapture keys on
  //     the biomarker name, so two "AA/EPA" rows would converge — flag up front)
  const seen = new Set<string>()
  const seenLoincCodes = new Set<string>()
  const seenCustomNames = new Set<string>()
  const duplicateBiomarkerIds = new Set<string>()
  const duplicateNames = new Set<string>()

  for (const marker of selectedMarkers) {
    if (marker.biomarker_id) {
      const biomarkerId = marker.biomarker_id
      if (seen.has(biomarkerId)) {
        duplicateBiomarkerIds.add(biomarkerId)
        duplicateNames.add(marker.catalog_name ?? marker.name)
        continue
      }
      seen.add(biomarkerId)
    } else if (marker.capture_loinc_code) {
      const code = marker.capture_loinc_code
      if (seenLoincCodes.has(code)) {
        duplicateNames.add(marker.catalog_name ?? marker.name)
        continue
      }
      seenLoincCodes.add(code)
    } else if (marker.capture_custom) {
      const key = marker.name.trim().toLowerCase()
      if (seenCustomNames.has(key)) {
        duplicateNames.add(marker.name)
        continue
      }
      seenCustomNames.add(key)
    }
  }

  // Across keyspaces: a custom row named like a mapped row's biomarker. The
  // server's custom capture keys on the name, so both would land on one
  // biomarker (or a case-variant twin) — e.g. after "Create all missing"
  // mapped an unmatched row while a same-named custom row stayed custom.
  const mappedNames = new Set(
    selectedMarkers
      .filter((marker) => marker.biomarker_id)
      .map((marker) => (marker.catalog_name ?? marker.name).trim().toLowerCase())
  )
  for (const marker of selectedMarkers) {
    if (
      !marker.biomarker_id &&
      !marker.capture_loinc_code &&
      marker.capture_custom &&
      mappedNames.has(marker.name.trim().toLowerCase())
    ) {
      duplicateNames.add(marker.name)
    }
  }

  const markers: PreparedMarkerEntry[] = selectedMarkers.map((marker) => {
    const base = {
      value: marker.value,
      qualifier: marker.qualifier ?? null,
      unit: marker.unit || marker.catalog_unit || 'ratio',
      ref_range_low: marker.ref_range_low ?? null,
      ref_range_high: marker.ref_range_high ?? null,
    }
    if (marker.biomarker_id) {
      return { biomarker_id: marker.biomarker_id, ...base }
    }
    if (marker.capture_loinc_code) {
      // Forward the raw lab name so commitCapture can store it as a match alias.
      return { capture_loinc_code: marker.capture_loinc_code, name: marker.name, ...base }
    }
    // capture_custom — guaranteed by the filter above.
    return { capture_custom: true as const, name: marker.name, ...base }
  })

  return {
    markers,
    duplicateBiomarkerIds: Array.from(duplicateBiomarkerIds),
    duplicateNames: Array.from(duplicateNames).sort(),
  }
}
