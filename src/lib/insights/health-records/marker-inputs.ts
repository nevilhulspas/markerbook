import { z } from 'zod'
import type { TypedSupabaseClient } from '@/lib/supabase/database'

import { matchBiomarkers } from '@/lib/extraction/match-biomarkers'
import { resolveMarker, commitCapture, commitCustomCapture } from '@/lib/loinc/resolve'
import type { Biomarker } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Marker-name resolution (pure — unit-testable)
// ---------------------------------------------------------------------------

export interface MarkerInput {
  name: string
  value: number
  unit?: string
  /** LOINC code the model is confident of — forwarded to the resolver's AI-code
   *  path so specialty markers (not in the catalog, weak on name search) resolve
   *  reliably. Validated against `loinc_terms` before any write; a bad code just
   *  falls back to name/NLM matching. */
  loinc_code?: string | null
}

export interface ResolvedMarker {
  biomarker_id: string
  /** Canonical catalog name (what the rest of the app shows). */
  name: string
  value: number
  unit: string
}

/**
 * Match free-text marker names against the biomarker catalog (names, short
 * names and aliases — same matcher the PDF import uses). Markers without a
 * unit fall back to the catalog unit. Duplicate names resolving to the same
 * biomarker keep the LAST value (so "actually it was 5.2" wins).
 */
export function resolveMarkerInputs(
  inputs: MarkerInput[],
  catalog: Biomarker[]
): { resolved: ResolvedMarker[]; unmatched: string[] } {
  const matched = matchBiomarkers(
    inputs.map((m) => ({
      name: m.name,
      value: m.value,
      unit: m.unit ?? '',
      confidence: 'high' as const,
      catalog_match: null,
    })),
    catalog
  )

  const unmatched: string[] = []
  const byBiomarker = new Map<string, ResolvedMarker>()
  for (const m of matched) {
    if (!m.biomarker_id) {
      unmatched.push(m.name)
      continue
    }
    byBiomarker.set(m.biomarker_id, {
      biomarker_id: m.biomarker_id,
      name: m.catalog_name ?? m.name,
      value: m.value,
      unit: m.unit || (m.catalog_unit ?? ''),
    })
  }
  return { resolved: Array.from(byBiomarker.values()), unmatched }
}

/**
 * Resolve free-text marker names through the shared LOINC engine (the same one
 * the PDF import uses): fast-path the existing catalog → AI/NLM fallback → for a
 * new lab-active LOINC code, CAPTURE a biomarker. Anything that STILL doesn't
 * resolve (specialty analytes, ratios like AA/EPA) is auto-created as a CUSTOM
 * (non-LOINC) catalog entry rather than dropped — a chat create/add IS the save
 * step, so both captures happen here. Those custom names come back in `custom`
 * so the caller can tell the user they were added as custom markers. `unmatched`
 * now only holds hard failures (empty name / DB error). `db` MUST be a
 * service-role client — capture writes the global `biomarkers` catalog, which
 * has no user-insert RLS. Duplicate names resolving to the same biomarker keep
 * the LAST value; same-code / same-name captures dedup inside the commit fns.
 */
export async function resolveMarkerInputsViaLoinc(
  inputs: MarkerInput[],
  catalog: Biomarker[],
  db: TypedSupabaseClient
): Promise<{ resolved: ResolvedMarker[]; unmatched: string[]; custom: string[] }> {
  const unmatched: string[] = []
  const customIds = new Set<string>()
  const byBiomarker = new Map<string, ResolvedMarker>()
  for (const input of inputs) {
    let biomarkerId: string
    let displayName: string
    try {
      const outcome = await resolveMarker(
        { name: input.name, unit: input.unit ?? '', loinc_code: input.loinc_code ?? null },
        catalog,
        { db }
      )
      if (outcome.status === 'matched') {
        biomarkerId = outcome.biomarkerId
        displayName = catalog.find((b) => b.id === biomarkerId)?.name ?? input.name
      } else if (outcome.status === 'capturable') {
        // Auto-create the LOINC-anchored biomarker now (this is the save step).
        biomarkerId = await commitCapture(
          outcome.loincCode,
          { name: input.name, unit: input.unit ?? '' },
          { db }
        )
        displayName = outcome.cleanName
      } else {
        // unresolved — no catalog/LOINC match. Auto-create a CUSTOM entry so the
        // marker is still saved (flagged is_custom for auditability).
        biomarkerId = await commitCustomCapture(
          { name: input.name, unit: input.unit ?? '' },
          { db }
        )
        displayName = input.name
        customIds.add(biomarkerId)
      }
    } catch (err) {
      // One marker failing (DB/AI error) must not drop the rest — report it.
      console.warn(`resolveMarkerInputsViaLoinc: failed to resolve "${input.name}":`, err)
      unmatched.push(input.name)
      continue
    }
    const catalogUnit = catalog.find((b) => b.id === biomarkerId)?.unit ?? ''
    byBiomarker.set(biomarkerId, {
      biomarker_id: biomarkerId,
      name: displayName,
      value: input.value,
      unit: input.unit && input.unit.length > 0 ? input.unit : catalogUnit,
    })
  }
  const resolved = Array.from(byBiomarker.values())
  const custom = resolved.filter((m) => customIds.has(m.biomarker_id)).map((m) => m.name)
  return { resolved, unmatched, custom }
}

// ---------------------------------------------------------------------------
// Shared marker input schema (create_blood_test / add_blood_results)
// ---------------------------------------------------------------------------

export const markerInputSchema = z.object({
  name: z.string().min(1).describe('Biomarker name (catalog name, short name or common alias — e.g. "Ferritin", "HbA1c", "Vitamin D").'),
  value: z.number().nonnegative(),
  unit: z.string().optional().describe('Unit as reported. Omit to use the catalog default unit.'),
  loinc_code: z
    .string()
    .regex(/^\d{1,7}-\d$/, 'Must be a LOINC code in "digits-checkdigit" form, e.g. "2692-2".')
    .optional()
    .describe(
      'LOINC code for this marker when you are confident of it (e.g. "2692-2" = Serum Osmolality, "1649-3" = Calcitriol/active vitamin D, "2629-4" = Methylmalonate, "27200-5" = ANA). Strongly recommended for specialty markers that aren\'t common catalog entries — it lets them auto-resolve and add instead of being dropped. The code is validated against the LOINC database, so a wrong guess is safely ignored (falls back to name matching); omit it when unsure.'
    ),
})
