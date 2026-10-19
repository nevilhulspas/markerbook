import { extractDocumentJson } from '@/lib/ai/extract-document'
import {
  MICROBIOME_EXTRACTION_SCHEMA,
  buildMicrobiomeExtractionPrompt,
} from '@/lib/microbiome/extraction-prompt'
import {
  microbiomeExtractionSchema,
  type MicrobiomeExtraction,
} from '@/lib/validations/microbiome-import'
import type { MediaType } from '@/lib/health-documents/media-type'
import { toFileContentBlocks } from '@/lib/health-documents/file-content'

export async function parseMicrobiomeBytes(
  bytes: Buffer | Buffer[],
  mediaType: MediaType
): Promise<MicrobiomeExtraction> {
  const fileContent = toFileContentBlocks(bytes, mediaType)

  return extractDocumentJson({
    content: [...fileContent, { type: 'text', text: buildMicrobiomeExtractionPrompt() }],
    maxTokens: 16384,
    schema: microbiomeExtractionSchema,
    jsonSchema: MICROBIOME_EXTRACTION_SCHEMA,
  })
}
