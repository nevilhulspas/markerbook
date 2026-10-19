import { buildOtherExtractionPrompt } from '@/lib/other/extraction-prompt'
import { extractDocumentJson } from '@/lib/ai/extract-document'
import { otherExtractionSchema, type OtherExtraction } from '@/lib/validations/other-import'
import type { MediaType } from '@/lib/health-documents/media-type'
import { toFileContentBlocks } from '@/lib/health-documents/file-content'

/** Parse one "other" test file's bytes -> validated extraction. */
export async function parseOtherBytes(
  bytes: Buffer | Buffer[],
  mediaType: MediaType,
): Promise<OtherExtraction> {
  const fileBlocks = toFileContentBlocks(bytes, mediaType)

  return extractDocumentJson({
    content: [...fileBlocks, { type: 'text', text: buildOtherExtractionPrompt() }],
    maxTokens: 4096,
    schema: otherExtractionSchema,
  })
}
