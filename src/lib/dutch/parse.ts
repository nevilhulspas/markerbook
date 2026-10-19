import { z } from 'zod'
import type { TypedSupabaseClient } from '@/lib/supabase/database'

import { extractDocumentJson } from '@/lib/ai/extract-document'
import { buildDutchExtractionPrompt, DUTCH_EXTRACTION_SCHEMA } from '@/lib/dutch/extraction-prompt'
import { matchDutchMarkers } from '@/lib/dutch/match-markers'
import type { Biomarker } from '@/lib/database.types'
import type { MediaType } from '@/lib/health-documents/media-type'
import { toFileContentBlocks } from '@/lib/health-documents/file-content'

export const dutchExtractedMarkerSchema = z.object({
  name: z.string(),
  value: z.number(),
  unit: z.string(),
  timepoint: z.enum(['waking', 'morning', 'afternoon', 'night', 'none']),
  confidence: z.enum(['high', 'medium', 'low']),
  catalog_match: z.string(),
})

export const dutchExtractionResultSchema = z.object({
  test_date: z.string(),
  patient_sex: z.enum(['male', 'female', 'unknown']),
  markers: z.array(dutchExtractedMarkerSchema),
})

export type DutchExtractionResult = z.infer<typeof dutchExtractionResultSchema>
export type DutchMatchedMarker = ReturnType<typeof matchDutchMarkers>[number]

export interface DutchParseResult {
  result: DutchExtractionResult
  matchedMarkers: DutchMatchedMarker[]
}

export async function parseDutchBytes(
  bytes: Buffer | Buffer[],
  mediaType: MediaType,
  db: TypedSupabaseClient
): Promise<DutchParseResult> {
  const { data: catalog, error } = await db.from('dutch_markers').select('*')
  if (error || !catalog) throw new Error('Failed to fetch DUTCH biomarker catalog')

  const fileContent = toFileContentBlocks(bytes, mediaType)

  const result = await extractDocumentJson({
    content: [...fileContent, { type: 'text', text: buildDutchExtractionPrompt(catalog as Biomarker[]) }],
    maxTokens: 8192,
    schema: dutchExtractionResultSchema,
    jsonSchema: DUTCH_EXTRACTION_SCHEMA,
    errors: {
      noText: 'No extraction result returned from Claude',
      invalid: 'Extraction result did not match the expected format',
    },
  })

  return { result, matchedMarkers: matchDutchMarkers(result.markers, catalog as Biomarker[]) }
}
