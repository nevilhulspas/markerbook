import type { TypedSupabaseClient } from '@/lib/supabase/database'
import type { BiomarkerHashInput } from '@/lib/catalog/description-hash'

/** Which catalogue a shared AI description belongs to. */
export type DescriptionTarget = 'biomarker' | 'dutch_marker'

export const DESCRIPTION_TABLE = {
  biomarker: 'biomarker_descriptions',
  dutch_marker: 'dutch_marker_descriptions',
} as const

/**
 * The catalogue context a shared description is written from, read from the
 * database — never from the request. The description is shown to every user,
 * so its prompt (and the hash stored next to it) must only reflect catalogue
 * data, not text a client sent. DUTCH markers carry no panel or system, as on
 * the DUTCH marker page.
 */
export async function loadDescriptionContext(
  db: TypedSupabaseClient,
  target: DescriptionTarget,
  markerId: string
): Promise<BiomarkerHashInput | null> {
  if (target === 'dutch_marker') {
    const [{ data: marker }, { data: ranges }] = await Promise.all([
      db.from('dutch_markers').select('name, category, unit').eq('id', markerId).maybeSingle(),
      db
        .from('dutch_reference_ranges')
        .select('sex, range_low, range_high, range_type')
        .eq('biomarker_id', markerId),
    ])
    if (!marker) return null
    return {
      name: marker.name,
      category: marker.category,
      unit: marker.unit,
      panelName: null,
      systemName: null,
      referenceRanges: (ranges ?? []).map((r) => ({
        sex: r.sex ?? 'all',
        range_low: r.range_low,
        range_high: r.range_high,
        range_type: r.range_type ?? 'normal',
      })),
    }
  }

  const [{ data: marker }, { data: ranges }] = await Promise.all([
    db
      .from('biomarkers')
      .select('name, category, unit, panels(name, systems(name))')
      .eq('id', markerId)
      .maybeSingle(),
    db
      .from('reference_ranges')
      .select('sex, range_low, range_high, range_type')
      .eq('biomarker_id', markerId),
  ])
  if (!marker) return null
  return {
    name: marker.name,
    category: marker.category,
    unit: marker.unit,
    panelName: marker.panels?.name ?? null,
    systemName: marker.panels?.systems?.name ?? null,
    referenceRanges: (ranges ?? []).map((r) => ({
      sex: r.sex ?? 'all',
      range_low: r.range_low,
      range_high: r.range_high,
      range_type: r.range_type ?? 'normal',
    })),
  }
}
