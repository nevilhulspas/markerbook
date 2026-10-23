'use server'

import { getSessionUser } from '@/lib/supabase/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  extensionFor,
  sniffMediaType,
  UNSUPPORTED_FILE_MESSAGE,
} from '@/lib/health-documents/media-type'
import { getHealthDocumentType } from '@/lib/health-documents/registry'
import type { ChatDocumentExtractionRow } from '@/lib/database.types'
import { isOwnedPath } from '@/lib/supabase/storage-path'

const ACCEPTED = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
])
const MAX_BYTES = 25 * 1024 * 1024 // 25 MB

export type UploadChatAttachmentResult =
  | { success: true; storagePath: string; mediaType: string; filename: string; signedUrl: string }
  | { success: false; error: string }

/** Upload a chat file to the lab-pdfs bucket under the user's namespace. */
export async function uploadChatAttachment(formData: FormData): Promise<UploadChatAttachmentResult> {
  const file = formData.get('file')
  if (!(file instanceof File)) return { success: false, error: 'No file provided' }
  if (!ACCEPTED.has(file.type)) return { success: false, error: 'Unsupported file type' }
  if (file.size > MAX_BYTES) return { success: false, error: 'File is too large (max 25 MB)' }

  const { user, authError } = await getSessionUser()
  if (!user) return { success: false, error: authError ?? 'Not authenticated' }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const sniffed = sniffMediaType(arrayBuffer)
  if (!sniffed) return { success: false, error: UNSUPPORTED_FILE_MESSAGE }

  const storagePath = `${user.id}/chat/${crypto.randomUUID()}.${extensionFor(sniffed)}`
  const { error: uploadError } = await supabaseAdmin.storage
    .from('lab-pdfs')
    .upload(storagePath, buffer, { contentType: sniffed, upsert: false })
  if (uploadError) return { success: false, error: `Upload failed: ${uploadError.message}` }

  const { data: signed } = await supabaseAdmin.storage.from('lab-pdfs').createSignedUrl(storagePath, 3600)
  return {
    success: true,
    storagePath,
    mediaType: sniffed,
    filename: file.name,
    signedUrl: signed?.signedUrl ?? '',
  }
}

/** Issue a fresh signed URL for a chat attachment. Upload-time URLs expire
 *  after an hour, so the transcript re-signs on demand (e.g. opening the image
 *  preview). Path is constrained to the caller's own chat namespace. */
export async function getChatAttachmentUrl(storagePath: string): Promise<string | null> {
  const { user } = await getSessionUser()
  if (!user) return null
  if (!isOwnedChatPath(user.id, storagePath)) return null

  const { data } = await supabaseAdmin.storage
    .from('lab-pdfs')
    .createSignedUrl(storagePath, 3600)
  return data?.signedUrl ?? null
}

/** Delete uploaded chat files the user discarded before sending (chip removed).
 *  Paths are constrained to the caller's own chat namespace. */
export async function deleteChatAttachment(storagePaths: string[]): Promise<void> {
  const { user } = await getSessionUser()
  if (!user) return

  const safe = storagePaths.filter((p) => isOwnedChatPath(user.id, p))
  if (safe.length > 0) {
    await supabaseAdmin.storage.from('lab-pdfs').remove(safe)
  }
}

/** A path inside the caller's own chat folder (see isOwnedPath). */
function isOwnedChatPath(userId: string, path: string): boolean {
  return isOwnedPath(userId, path) && path.startsWith(`${userId}/chat/`)
}

export type PersistChatDocumentResult =
  | { success: true; href: string }
  | { success: false; error: string }

/** Persist a cached chat extraction via its registry entry. Triggered by "Log it". */
export async function persistChatDocument(extractionId: string): Promise<PersistChatDocumentResult> {
  const { user, authError } = await getSessionUser()
  if (!user) return { success: false, error: authError ?? 'Not authenticated' }

  const { data: row } = await supabaseAdmin
    .from('chat_document_extractions')
    .select('*')
    .eq('id', extractionId)
    .single<ChatDocumentExtractionRow>()

  if (!row || row.user_id !== user.id) return { success: false, error: 'Extraction not found' }
  if (!isOwnedPath(user.id, row.storage_path)) {
    return { success: false, error: 'This file is not authorized for your account.' }
  }

  const type = getHealthDocumentType(row.document_type)
  if (!type) return { success: false, error: `Unknown document type: ${row.document_type}` }

  try {
    const { href } = await type.persist(row.extraction as never, row.storage_path)
    await supabaseAdmin.from('chat_document_extractions').delete().eq('id', extractionId)
    return { success: true, href }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to log document' }
  }
}
