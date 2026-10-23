import type { Biomarker } from '@/lib/database.types'
import type { ExtractedMarker, MatchedMarker } from './types'

/**
 * Match extracted markers against the biomarker catalog using
 * Claude's AI-provided catalog_match field (primary) with
 * fallback to exact name/alias matching.
 *
 * Parent-only biomarkers (those with children in the catalog) are
 * excluded as match targets. Ambiguous names that match a parent
 * biomarker resolve to its "total" variant (most common lab convention),
 * and stay unmatched when it has none: "Bilirubin" must never land on
 * "Bilirubin (Direct)".
 */
/** IDs of group containers: catalogue rows that other rows point to as parent. */
export function groupContainerIds(catalog: Pick<Biomarker, 'parent_id'>[]): Set<string> {
  return new Set(
    catalog.filter((b) => b.parent_id != null).map((b) => b.parent_id!)
  )
}

export function matchBiomarkers(
  extracted: ExtractedMarker[],
  catalog: Biomarker[]
): MatchedMarker[] {
  // Find parent IDs that have children
  const parentIds = groupContainerIds(catalog)

  // Build lookup maps excluding parent-only biomarkers
  const matchable = catalog.filter((b) => !parentIds.has(b.id))
  const byName = new Map<string, Biomarker>()
  const byAlias = new Map<string, Biomarker>()

  for (const b of matchable) {
    byName.set(b.name.toLowerCase(), b)
    if (b.short_name) byAlias.set(b.short_name.toLowerCase(), b)
    for (const alias of b.aliases ?? []) {
      byAlias.set(alias.toLowerCase(), b)
    }
  }

  return extracted.map((marker) => {
    let match: Biomarker | undefined

    // 1. AI-provided catalog_match (most reliable)
    if (marker.catalog_match) {
      match = byName.get(marker.catalog_match.toLowerCase())
    }

    // 2. Fallback: exact name match against catalog names/aliases
    if (!match) {
      const normalized = marker.name.toLowerCase().trim()
      match = byName.get(normalized) ?? byAlias.get(normalized)
    }

    // 3. Ambiguous name fallback: if the extracted name matches a parent name,
    // default to the "total" variant (most common lab convention)
    if (!match) {
      const normalized = marker.name.toLowerCase().trim()
      const parentMatch = catalog.find(
        (b) => parentIds.has(b.id) && b.name.toLowerCase() === normalized
      )
      if (parentMatch) {
        // Only the "total" variant of this parent. Any other child is a
        // different measurement, so no total variant means no match.
        match = catalog.find(
          (b) => b.parent_id === parentMatch.id && b.variant_name === 'total'
        )
      }
    }

    return {
      ...marker,
      biomarker_id: match?.id ?? null,
      catalog_name: match?.name ?? null,
      catalog_unit: match?.unit ?? null,
      matched: !!match,
      selected: true,
    }
  })
}
