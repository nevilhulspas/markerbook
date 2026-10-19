import type Anthropic from '@anthropic-ai/sdk'

import type { MediaType } from '@/lib/health-documents/media-type'

/**
 * Build Anthropic content blocks for one or more uploaded files. A single
 * Buffer (a PDF or one image) yields one block; an array (image tiles produced
 * from a long document — see image-tiles.ts) yields one image block per tile,
 * which the model reads as consecutive pages. All tiles share one `mediaType`
 * (the client re-encodes tiles to JPEG).
 */
export function toFileContentBlocks(
  bytes: Buffer | Buffer[],
  mediaType: MediaType
): Anthropic.Messages.ContentBlockParam[] {
  const list = Array.isArray(bytes) ? bytes : [bytes]
  return list.map((b): Anthropic.Messages.ContentBlockParam => {
    const data = b.toString('base64')
    if (mediaType === 'application/pdf') {
      return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
    }
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
        data,
      },
    }
  })
}
