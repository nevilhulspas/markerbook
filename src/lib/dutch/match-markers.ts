import type { Biomarker } from '@/lib/database.types'
import type { DutchExtractedMarker, DutchMatchedMarker } from './types'

/**
 * Match extracted DUTCH markers against the biomarker catalog using
 * Claude's AI-provided catalog_match field (primary) with
 * fallback to exact name/alias matching.
 *
 * Matches against all dutch_* category biomarkers including parents,
 * since DUTCH parent markers (Estrone, Estradiol, Testosterone) are
 * also directly measurable — unlike blood test grouping categories.
 */
export function matchDutchMarkers(
  extracted: DutchExtractedMarker[],
  catalog: Biomarker[]
): DutchMatchedMarker[] {
  // Filter to DUTCH categories only
  const dutchCatalog = catalog.filter((b) => b.category.startsWith('dutch_'))

  // All DUTCH markers are matchable (parents are also measurable)
  const matchable = dutchCatalog
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

    // 2b. Strip parenthetical suffixes like "(E1)", "(E2)", "(HVA)" and retry
    if (!match) {
      const stripped = marker.name.replace(/\s*\([^)]+\)\s*$/, '').toLowerCase().trim()
      if (stripped !== marker.name.toLowerCase().trim()) {
        match = byName.get(stripped) ?? byAlias.get(stripped)
      }
      // Also try the content inside parentheses as an alias
      if (!match) {
        const parenMatch = marker.name.match(/\(([^)]+)\)/)
        if (parenMatch) {
          const inner = parenMatch[1].toLowerCase().trim()
          match = byAlias.get(inner) ?? byName.get(inner)
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
