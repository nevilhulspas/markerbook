import { tool } from 'ai'
import { z } from 'zod'
import type { TypedSupabaseClient } from '@/lib/supabase/database'
import { isOwnedPath } from '@/lib/supabase/storage-path'

// `read_test_document` — lets the chat model pull the ORIGINAL uploaded document
// for a stored test (blood, DEXA, microbiome, DUTCH, RMR, or "other") and see it
// directly, so it can OCR/scan handwriting, free-text notes, charts and other
// nuances the structured readings don't capture (e.g. a dental chart PDF).
//
// execute() only resolves + authorizes the storage path (kept tiny so the
// persisted tool result stays small). toModelOutput() downloads the bytes and
// hands them to the vision-capable chat model as a content block, so it reads
// the document natively — no separate OCR pass. Docs live in the `lab-pdfs`
// bucket, path-namespaced by user id.

const TEST_DOC_TABLES = {
  blood: { table: 'blood_tests', label: 'blood test' },
  dexa: { table: 'dexa_scans', label: 'DEXA scan' },
  microbiome: { table: 'microbiome_tests', label: 'microbiome test' },
  dutch: { table: 'dutch_tests', label: 'DUTCH test' },
  rmr: { table: 'rmr_tests', label: 'RMR test' },
  other: { table: 'other_tests', label: 'other test' },
} as const

type TestDocType = keyof typeof TEST_DOC_TABLES

function mediaTypeForPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'pdf') return 'application/pdf'
  return 'application/pdf' // best default for lab reports
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

type DocMeta = { ok: true; path: string; mediaType: string; filename: string }
type DocError = { error: string }

// Anthropic caps document/image blocks well below this; refuse oversized files
// with a friendly message instead of letting the API reject the whole turn.
const MAX_DOC_BYTES = 10 * 1024 * 1024 // 10 MB

export function createDocumentReadTools(supabase: TypedSupabaseClient, userId: string) {
  return {
    read_test_document: tool({
      description:
        "Fetch and READ the original uploaded document for one of the user's tests (blood, DEXA, microbiome, DUTCH, RMR, or 'other'). Use this when the structured readings aren't enough and you need to inspect the source — handwritten notes, free-text sections, charts/diagrams, footnotes, or to double-check a value. Returns the actual document (image or PDF) so you can read it directly. Get the id first from the matching list tool (list_blood_tests / list_health_tests / list_other_tests). Only call when a document exists — most manually-typed entries have none.",
      inputSchema: z.object({
        type: z.enum(['blood', 'dexa', 'microbiome', 'dutch', 'rmr', 'other']),
        id: z.string(),
      }),
      execute: async ({ type, id }: { type: TestDocType; id: string }): Promise<DocMeta | DocError> => {
        const { table, label } = TEST_DOC_TABLES[type]
        const { data: row, error } = await supabase
          .from(table)
          .select('id, pdf_storage_path')
          .eq('id', id)
          .eq('user_id', userId)
          .maybeSingle()
        if (error) return { error: error.message }
        if (!row) return { error: `${label} not found.` }
        const path = (row as { pdf_storage_path: string | null }).pdf_storage_path
        if (!path) return { error: `This ${label} has no uploaded document to read (it was entered manually).` }
        // Never read a path outside the caller's own namespace.
        if (!isOwnedPath(userId, path)) return { error: 'Unauthorized document path.' }
        return { ok: true, path, mediaType: mediaTypeForPath(path), filename: path.split('/').pop() ?? 'document' }
      },
      toModelOutput: async ({ output }) => {
        const text = (t: string) => ({ type: 'content' as const, value: [{ type: 'text' as const, text: t }] })
        if (!output || typeof output !== 'object' || !('ok' in output)) {
          return text((output as DocError | null)?.error ?? 'Could not read the document.')
        }
        const { path, mediaType, filename } = output as DocMeta
        const { data: blob, error: dlErr } = await supabase.storage.from('lab-pdfs').download(path)
        if (dlErr || !blob) return text(`Could not download the document: ${dlErr?.message ?? 'not found'}.`)
        const bytes = new Uint8Array(await blob.arrayBuffer())
        if (bytes.length > MAX_DOC_BYTES) {
          return text(
            `This document is too large to read inline (${(bytes.length / 1024 / 1024).toFixed(1)} MB). Ask the user to open it directly instead.`
          )
        }
        return {
          type: 'content',
          value: [
            { type: 'text', text: `Original document (${filename}). Read it directly for any nuances.` },
            { type: 'file', data: { type: 'data', data: bytesToBase64(bytes) }, mediaType, filename },
          ],
        }
      },
    }),
  }
}
