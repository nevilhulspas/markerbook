import type { Biomarker } from '@/lib/database.types'
import type { MatchedMarker } from '@/lib/extraction/types'

// Pure list operations for the blood-test import review step. Each returns a
// new array (never mutates) so the caller can hand it straight to onMarkersChange.

export interface UnitOption {
  value: string
  label: string
}

/**
 * How an extracted marker will be saved:
 * - matched: mapped to a catalog biomarker
 * - capturable: resolved to a new LOINC code — auto-saved by commitCapture
 * - custom: no catalog/LOINC match — auto-saved as a custom (non-LOINC) biomarker
 * - unresolved: could not be placed at all — needs manual mapping or auto-create
 */
export type MarkerResolution = 'matched' | 'capturable' | 'custom' | 'unresolved'

export function getMarkerResolution(marker: MatchedMarker): MarkerResolution {
  if (marker.matched) return 'matched'
  if (marker.capture_loinc_code) return 'capturable'
  if (marker.capture_custom) return 'custom'
  return 'unresolved'
}

export function hasDuplicateSelection(
  marker: MatchedMarker,
  duplicateIds: ReadonlySet<string>
): boolean {
  return (
    marker.selected &&
    !!marker.biomarker_id &&
    duplicateIds.has(marker.biomarker_id)
  )
}

function newRowId(): string {
  return crypto.randomUUID()
}

/**
 * Give every row a stable `row_id`, so React keys (and each row's combobox
 * text) follow the row through moves and inserts instead of its index.
 * Returns the same array when nothing was missing.
 */
export function withRowIds(markers: MatchedMarker[]): MatchedMarker[] {
  if (markers.every((m) => m.row_id)) return markers
  return markers.map((m) => (m.row_id ? m : { ...m, row_id: newRowId() }))
}

/** The React key / selection key for a review row. */
export function rowKeyOf(marker: MatchedMarker, index: number): string {
  return marker.row_id ?? `index-${index}`
}

export function createEmptyMarker(): MatchedMarker {
  return {
    name: '',
    value: 0,
    unit: '',
    confidence: 'low',
    catalog_match: null,
    biomarker_id: null,
    catalog_name: null,
    catalog_unit: null,
    matched: false,
    selected: true,
    row_id: newRowId(),
  }
}

export function updateMarkerAt(
  markers: MatchedMarker[],
  index: number,
  updates: Partial<MatchedMarker>
): MatchedMarker[] {
  return markers.map((m, i) => (i === index ? { ...m, ...updates } : m))
}

export function removeMarkerAt(markers: MatchedMarker[], index: number): MatchedMarker[] {
  return markers.filter((_, i) => i !== index)
}

export function removeMarkersAt(
  markers: MatchedMarker[],
  indexes: ReadonlySet<number>
): MatchedMarker[] {
  return markers.filter((_, i) => !indexes.has(i))
}

export function insertEmptyMarker(
  markers: MatchedMarker[],
  index: number,
  position: 'above' | 'below'
): MatchedMarker[] {
  const newMarkers = [...markers]
  newMarkers.splice(position === 'above' ? index : index + 1, 0, createEmptyMarker())
  return newMarkers
}

/** Returns null when the move would leave the list (nothing to change). */
export function moveMarkerAt(
  markers: MatchedMarker[],
  index: number,
  direction: 'up' | 'down'
): MatchedMarker[] | null {
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= markers.length) return null
  const newMarkers = [...markers]
  const [moved] = newMarkers.splice(index, 1)
  newMarkers.splice(target, 0, moved)
  return newMarkers
}

/** Row updates for mapping a marker to a biomarker, or clearing the mapping (null). */
export function biomarkerMappingUpdates(biomarker: Biomarker | null): Partial<MatchedMarker> {
  if (!biomarker) {
    return {
      biomarker_id: null,
      catalog_name: null,
      catalog_unit: null,
      matched: false,
    }
  }
  return {
    biomarker_id: biomarker.id,
    catalog_name: biomarker.name,
    catalog_unit: biomarker.unit,
    matched: true,
  }
}

/** Map freshly created biomarkers back to their marker rows by (lowercased) name. */
export function applyCreatedBiomarkers(
  markers: MatchedMarker[],
  created: Biomarker[]
): MatchedMarker[] {
  const byName = new Map(created.map((b) => [b.name.toLowerCase(), b]))

  return markers.map((m) => {
    // Only remap unresolved rows — the ones "Create all missing" created
    // biomarkers for. Matched, capturable (LOINC) and custom rows keep their
    // own resolution even when a new biomarker shares their name.
    if (getMarkerResolution(m) !== 'unresolved') return m
    const match = byName.get(m.name.toLowerCase())
    if (match) {
      return {
        ...m,
        biomarker_id: match.id,
        catalog_name: match.name,
        catalog_unit: match.unit,
        matched: true,
      }
    }
    return m
  })
}

/** Unique unit options from catalog + extracted markers + locally created. */
export function buildUnitOptions(
  biomarkers: Biomarker[],
  markers: MatchedMarker[],
  localUnits: string[]
): UnitOption[] {
  const units = new Set<string>()
  biomarkers.forEach((b) => { if (b.unit) units.add(b.unit) })
  markers.forEach((m) => { if (m.unit) units.add(m.unit) })
  localUnits.forEach((u) => units.add(u))
  return Array.from(units)
    .sort()
    .map((u) => ({ value: u, label: u }))
}

export function unitFilter(unit: UnitOption, query: string): boolean {
  if (unit.value === '__create_new_unit__') return true
  return unit.value.toLowerCase().includes(query.toLowerCase()) ||
    unit.label.toLowerCase().includes(query.toLowerCase())
}

/** Catalog biomarkers plus locally created ones not already in the catalog. */
export function mergeLocalBiomarkers(
  biomarkers: Biomarker[],
  localBiomarkers: Biomarker[]
): Biomarker[] {
  const existingIds = new Set(biomarkers.map((b) => b.id))
  const newOnes = localBiomarkers.filter((b) => !existingIds.has(b.id))
  return [...biomarkers, ...newOnes]
}
