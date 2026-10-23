import { tool } from 'ai'
import { z } from 'zod'
import type { TypedSupabaseClient } from '@/lib/supabase/database'
import { isOwnedAttachment, isOwnedPath } from '@/lib/supabase/storage-path'
import { takeAiRequest } from '@/lib/ai/quota'

import { detectMediaType, SNIFF_BYTES } from '@/lib/health-documents/media-type'
import { getHealthDocumentType, HEALTH_DOCUMENT_TYPES } from '@/lib/health-documents/registry'
import type { ChatAttachment } from '@/lib/database.types'
import type { Json } from '@/lib/supabase/database.generated'

const documentTypeEnum = z.enum(
  HEALTH_DOCUMENT_TYPES.map((t) => t.id) as [string, ...string[]]
)

/**
 * Tools for indexing an uploaded health document.
 * - extract_health_document (server execute): parse the attachment via the
 *   registry, cache the result, return a summary for the confirm card.
 * - confirm_health_document_index (NO execute -> client-resolved): the chat
 *   renders the Log it / Just this chat card and returns the choice.
 */
export function createDocumentIndexTools(
  supabase: TypedSupabaseClient,
  userId: string,
  attachments: ChatAttachment[],
  threadId: string
) {
  return {
    extract_health_document: tool({
      description:
        'Parse an uploaded health document (the file attached to the user message) into structured data, so the user can choose to log it. Call this when an attachment matches one of the known document types. Returns a summary + extractionId to pass to confirm_health_document_index.',
      inputSchema: z.object({
        documentType: documentTypeEnum.describe('Which known health-document type the attachment is.'),
        attachmentIndex: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Which attachment on the message (0-based). Defaults to the last one.'),
      }),
      execute: async ({ documentType, attachmentIndex }) => {
        const att = attachments[attachmentIndex ?? attachments.length - 1]
        if (!att) return { error: 'No attachment found on this message to index.' }
        if (!isOwnedAttachment(userId, att)) return { error: 'This file is not authorized for your account.' }

        const type = getHealthDocumentType(documentType)
        if (!type) return { error: `Unknown document type: ${documentType}` }

        // A long image is stored as several page tiles (att.parts); download
        // them all and parse together. A normal upload has a single piece.
        const paths = att.parts && att.parts.length > 0 ? att.parts : [att.storagePath]
        const buffers: Buffer[] = []
        for (const path of paths) {
          if (!isOwnedPath(userId, path)) return { error: 'This file is not authorized for your account.' }
          const { data: blob, error: dlErr } = await supabase.storage.from('lab-pdfs').download(path)
          if (dlErr || !blob) return { error: 'Could not read the uploaded file.' }
          buffers.push(Buffer.from(await blob.arrayBuffer()))
        }
        const mediaType = detectMediaType(new Uint8Array(buffers[0].subarray(0, SNIFF_BYTES)))
        if (!mediaType) return { error: 'The uploaded file is not a supported PDF or image.' }

        // The parse is a full model call of its own on top of the chat turn.
        const quota = await takeAiRequest(userId)
        if (!quota.ok) return { error: quota.error }

        let extraction: unknown
        try {
          // Single buffer when there's one piece, the tile list otherwise.
          extraction = await type.parse(buffers.length === 1 ? buffers[0] : buffers, mediaType, {
            userId,
            db: supabase,
          })
        } catch (err) {
          return { error: `Could not read this as a ${type.label}: ${err instanceof Error ? err.message : 'parse failed'}` }
        }

        const { data: row, error: insErr } = await supabase
          .from('chat_document_extractions')
          .insert({
            user_id: userId,
            thread_id: threadId,
            storage_path: att.storagePath,
            document_type: type.id,
            // Parsed JSON from the type's parser; the column is jsonb.
            extraction: extraction as Json,
          })
          .select('id')
          .single()
        if (insErr || !row) return { error: 'Failed to cache the extraction.' }

        return { extractionId: row.id as string, documentType: type.id, summary: type.summarize(extraction as never) }
      },
    }),

    confirm_health_document_index: tool({
      description:
        'After extract_health_document succeeds, ask the user whether to log the document to their record (persists it; it then appears in future chats) or keep it for this chat only. Pass through the extractionId, documentType and summary from the extract result. The chat renders the choice.',
      inputSchema: z.object({
        extractionId: z.string(),
        documentType: documentTypeEnum,
        summary: z.object({
          title: z.string(),
          dateLabel: z.string().nullable(),
          lines: z.array(z.string()),
        }),
      }),
      // No execute: resolved on the client (DocumentIndexCard -> addToolOutput).
    }),
  }
}
