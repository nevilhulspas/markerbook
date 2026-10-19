import { buildRmrExtractionPrompt } from '@/lib/rmr/extraction-prompt'
import { extractDocumentJson } from '@/lib/ai/extract-document'
import { rmrExtractionSchema, type RmrExtraction } from '@/lib/validations/rmr-import'
import type { MediaType } from '@/lib/health-documents/media-type'
import { toFileContentBlocks } from '@/lib/health-documents/file-content'

/** Parse one RMR file's bytes -> validated extraction. No profile fallback. */
export async function parseRmrBytes(
  bytes: Buffer | Buffer[],
  mediaType: MediaType,
): Promise<RmrExtraction> {
  const fileBlocks = toFileContentBlocks(bytes, mediaType)

  return extractDocumentJson({
    content: [...fileBlocks, { type: 'text', text: buildRmrExtractionPrompt() }],
    maxTokens: 4096,
    schema: rmrExtractionSchema,
  })
}
