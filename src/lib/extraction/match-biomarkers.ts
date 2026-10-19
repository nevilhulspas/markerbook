import type { Biomarker } from '@/lib/database.types'
import type { ExtractedMarker, MatchedMarker } from './types'

/**
 * Match extracted markers against the biomarker catalog using
 * Claude's AI-provided catalog_match field (primary) with
 * fallback to exact name/alias matching.
 *
 * Parent-only biomarkers (those with children in the catalog) are
 * excluded as match targets. Ambiguous names that match a parent
 * biomarker resolve to the "total" variant (most common lab convention).
 */
export function matchBiomarkers(
  extracted: ExtractedMarker[],
  catalog: Biomarker[]
): MatchedMarker[] {
  // Find parent IDs that have children
  const parentIds = new Set(
    catalog.filter((b) => b.parent_id != null).map((b) => b.parent_id!)
  )

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
        // Find the "total" variant of this parent
        match = catalog.find(
          (b) => b.parent_id === parentMatch.id && b.variant_name === 'total'
        )
        // If no "total" variant, use any child
        if (!match) {
          match = catalog.find((b) => b.parent_id === parentMatch.id)
        }
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
