import type { TypedSupabaseClient } from '@/lib/supabase/database'

import { extractDocumentJson } from '@/lib/ai/extract-document'
import { buildDexaExtractionPrompt } from '@/lib/dexa/extraction-prompt'
import { rawExtractionSchema, normalizeExtraction, type DexaExtraction } from '@/lib/validations/dexa-import'
import type { MediaType } from '@/lib/health-documents/media-type'
import { toFileContentBlocks } from '@/lib/health-documents/file-content'

/** Fractional age in years at onDate (ISO) for someone born dob (ISO). */
export function ageYearsAt(dob: string, onDate: string): number | null {
  const d = new Date(dob).getTime()
  const o = new Date(onDate).getTime()
  if (Number.isNaN(d) || Number.isNaN(o) || o < d) return null
  return Math.round(((o - d) / (365.25 * 86_400_000)) * 10) / 10
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
    const p = profile as { date_of_birth: string | null; height_cm: number | null } | null
    if (p) {
      if (data.scan.height_cm == null && p.height_cm != null) data.scan.height_cm = p.height_cm
      if (data.scan.age_years == null && p.date_of_birth) data.scan.age_years = ageYearsAt(p.date_of_birth, data.scan.scan_date)
    }
  }
  return data
}
