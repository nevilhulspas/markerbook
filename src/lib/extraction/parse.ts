import type { TypedSupabaseClient } from '@/lib/supabase/database'

import { extractDocumentJson } from '@/lib/ai/extract-document'
import { buildExtractionPrompt, EXTRACTION_SCHEMA } from '@/lib/extraction/prompt'
import { resolveExtractedMarkers } from '@/lib/extraction/resolve-markers'
import { extractionResultSchema } from '@/lib/validations/pdf-import'
import type { Biomarker } from '@/lib/database.types'
import type { ExtractionResult, MatchedMarker } from '@/lib/extraction/types'
import type { MediaType } from '@/lib/health-documents/media-type'
import { toFileContentBlocks } from '@/lib/health-documents/file-content'

export interface BloodParseResult {
  result: ExtractionResult
  matchedMarkers: MatchedMarker[]
  unresolved: string[]
}

/** Parse already-uploaded bloodwork bytes -> extraction + catalog matches. No upload. */
export async function parseBloodBytes(
  bytes: Buffer | Buffer[],
  mediaType: MediaType,
  db: TypedSupabaseClient
): Promise<BloodParseResult> {
  const { data: catalog, error } = await db
    .from('biomarkers')
    .select('*')
    .is('archived_at', null)
  if (error || !catalog) throw new Error('Failed to fetch biomarker catalog')

  const fileContent = toFileContentBlocks(bytes, mediaType)

  // Large reports (100+ markers) with the per-marker loinc_code + range fields
  // can exceed a small max_tokens and truncate the JSON mid-string. Stream with a
  // generous ceiling (Sonnet 5.5 supports up to 128K output but requires
  // streaming for large values to avoid HTTP timeouts). No up-front thinking
  // (`between_tools`, the lowest setting — `disabled` no longer exists on the
  // 5.5 models): extraction is transcription, not reasoning, and thinking would
  // share this budget and slow every import down for no accuracy gain.
  const result = await extractDocumentJson({
    content: [...fileContent, { type: 'text', text: buildExtractionPrompt(catalog as Biomarker[]) }],
    maxTokens: 64000,
    stream: true,
    schema: extractionResultSchema,
    jsonSchema: EXTRACTION_SCHEMA,
    truncatedMessage:
      'This report is too large to extract in one pass (the result was cut off). Try splitting the PDF into fewer pages and importing each part.',
    errors: {
      noText: 'No extraction result returned from Claude',
      invalid: 'Extraction result did not match the expected format',
    },
  })

  const { matchedMarkers, unresolved } = await resolveExtractedMarkers(
    result.markers,
    catalog as Biomarker[],
    { db },
  )

  return { result, matchedMarkers, unresolved }
}
