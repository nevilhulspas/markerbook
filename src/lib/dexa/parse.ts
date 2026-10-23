import type { TypedSupabaseClient } from '@/lib/supabase/database'

import { extractDocumentJson } from '@/lib/ai/extract-document'
import { buildDexaExtractionPrompt } from '@/lib/dexa/extraction-prompt'
import { rawExtractionSchema, normalizeExtraction, type DexaExtraction } from '@/lib/validations/dexa-import'
import type { MediaType } from '@/lib/health-documents/media-type'
import { toFileContentBlocks } from '@/lib/health-documents/file-content'
import { deriveFfmi } from '@/lib/body/metrics'

/** Fractional age in years at onDate (ISO) for someone born dob (ISO). */
export function ageYearsAt(dob: string, onDate: string): number | null {
  const d = new Date(dob).getTime()
  const o = new Date(onDate).getTime()
  if (Number.isNaN(d) || Number.isNaN(o) || o < d) return null
  return Math.round(((o - d) / (365.25 * 86_400_000)) * 10) / 10
}

/**
 * Fill a scan's missing height and age from the profile, then derive FFMI if
 * the report did not print it. FFMI needs the height, so it must be derived
 * after the height fallback: before, a scan without a printed height never
 * got an FFMI. Mutates and returns `data`.
 */
export function applyProfileFallback(
  data: DexaExtraction,
  profile: { date_of_birth: string | null; height_cm: number | null } | null
): DexaExtraction {
  if (profile) {
    if (data.scan.height_cm == null && profile.height_cm != null) data.scan.height_cm = profile.height_cm
    if (data.scan.age_years == null && profile.date_of_birth) {
      data.scan.age_years = ageYearsAt(profile.date_of_birth, data.scan.scan_date)
    }
  }
  if (data.scan.ffmi == null) {
    data.scan.ffmi = deriveFfmi(data.scan.lean_mass_g, data.scan.bmc_g, data.scan.height_cm)
  }
  return data
}

/** Parse one DEXA file's bytes -> normalized extraction, with profile fallback. */
export async function parseDexaBytes(
  bytes: Buffer | Buffer[],
  mediaType: MediaType,
  userId: string,
  db: TypedSupabaseClient
): Promise<DexaExtraction> {
  const fileBlocks = toFileContentBlocks(bytes, mediaType)

  const raw = await extractDocumentJson({
    content: [...fileBlocks, { type: 'text', text: buildDexaExtractionPrompt() }],
    maxTokens: 16384,
    schema: rawExtractionSchema,
  })
  const data = normalizeExtraction(raw)

  if (data.scan.age_years == null || data.scan.height_cm == null) {
    const { data: profile } = await db
      .from('profiles')
      .select('date_of_birth, height_cm')
      .eq('id', userId)
      .maybeSingle()
    applyProfileFallback(data, profile as { date_of_birth: string | null; height_cm: number | null } | null)
  }
  return data
}
