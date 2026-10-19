import type { Biomarker } from '@/lib/database.types'

/** The biomarker fields the combobox search looks at (Biomarker and DutchMarker both fit). */
export type BiomarkerSearchable = Pick<
  Biomarker,
  'name' | 'short_name' | 'variant_name' | 'aliases' | 'category'
>

export interface BiomarkerSearchOptions {
  /** Also search variant_name (placed between short_name and aliases). Default false. */
  includeVariantName?: boolean
}

/**
 * Combobox filter for picking a biomarker: a case-insensitive substring match
 * against name, short_name, (optionally) variant_name, aliases and category,
 * joined by single spaces — so a query can span adjacent fields. The query is
 * not trimmed and diacritics are not folded.
 */
export function matchesBiomarkerQuery(
  biomarker: BiomarkerSearchable,
  query: string,
  options: BiomarkerSearchOptions = {}
): boolean {
  const q = query.toLowerCase()
  const searchText = [
    biomarker.name,
    biomarker.short_name ?? '',
    ...(options.includeVariantName ? [biomarker.variant_name ?? ''] : []),
    ...biomarker.aliases,
    biomarker.category,
  ]
    .join(' ')
    .toLowerCase()
  return searchText.includes(q)
}
