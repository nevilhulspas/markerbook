import type { TypedSupabaseClient } from '@/lib/supabase/database'

/** AI-generated display info + LOINC component for a code. */
export interface LoincDisplay {
  clean_name: string | null
  abbreviation: string | null
  component: string | null
}

/**
 * Fetch the LOINC display layer (clean_name + abbreviation, from loinc_display)
 * and the LOINC component (from loinc_terms) for a set of codes, keyed by code.
 * `biomarkers.loinc_code` is plain text (no FK), so this uses side queries rather
 * than PostgREST embeds.
 */
export async function getLoincDisplayMap(
  db: TypedSupabaseClient,
  codes: (string | null | undefined)[],
): Promise<Map<string, LoincDisplay>> {
  const uniq = [...new Set(codes.filter((c): c is string => !!c))]
  const map = new Map<string, LoincDisplay>()
  for (let i = 0; i < uniq.length; i += 400) {
    const slice = uniq.slice(i, i + 400)
    const [{ data: disp, error: dispErr }, { data: terms, error: termsErr }] = await Promise.all([
      db.from('loinc_display').select('loinc_num, clean_name, abbreviation').in('loinc_num', slice),
      db.from('loinc_terms').select('loinc_num, component').in('loinc_num', slice),
    ])
    // Fallback to raw biomarker names is intentional, but surface the failure so a
    // degraded display layer is visible in logs rather than silently empty.
    if (dispErr) console.warn('getLoincDisplayMap: loinc_display query failed:', dispErr.message)
    if (termsErr) console.warn('getLoincDisplayMap: loinc_terms query failed:', termsErr.message)
    for (const r of (disp ?? []) as { loinc_num: string; clean_name: string | null; abbreviation: string | null }[]) {
      map.set(r.loinc_num, { clean_name: r.clean_name, abbreviation: r.abbreviation, component: null })
    }
    for (const r of (terms ?? []) as { loinc_num: string; component: string | null }[]) {
      const e = map.get(r.loinc_num) ?? { clean_name: null, abbreviation: null, component: null }
      e.component = r.component
      map.set(r.loinc_num, e)
    }
  }
  return map
}

/**
 * Resolve the display name + short badge for a biomarker, preferring the LOINC
 * clean_name / abbreviation when available, falling back to the curated fields.
 */
export function resolveDisplay(
  bm: { name: string; short_name: string | null; loinc_code?: string | null },
  displayMap: Map<string, LoincDisplay>,
): { name: string; shortName: string | null } {
  const d = bm.loinc_code ? displayMap.get(bm.loinc_code) : undefined
  return {
    name: d?.clean_name || bm.name,
    shortName: d?.abbreviation || bm.short_name,
  }
}

/**
 * The LOINC "family" key for a component: the base analyte before any dot-modifier
 * or ratio slash. E.g. "Triiodothyronine.free" -> "Triiodothyronine",
 * "Cholesterol.in HDL" -> "Cholesterol", "Cholesterol.total/Cholesterol.in HDL" ->
 * "Cholesterol". Returns null when there is no component.
 */
export function loincFamilyKey(component: string | null | undefined): string | null {
  if (!component) return null
  const base = component.split(/[./]/)[0].trim()
  return base || null
}
