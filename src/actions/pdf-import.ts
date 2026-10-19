'use server'

import { getSessionUser } from '@/lib/supabase/session'
import { takeAiRequest } from '@/lib/ai/quota'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ExtractionResponse } from '@/lib/extraction/types'
import {
  extensionFor,
  sniffMediaType,
  UNSUPPORTED_FILE_MESSAGE,
} from '@/lib/health-documents/media-type'

const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

export async function extractFromPdf(
  formData: FormData
): Promise<ExtractionResponse> {
  const file = formData.get('pdf') as File | null
  if (!file || !ACCEPTED_TYPES.has(file.type)) {
    return { success: false, error: 'No valid PDF or image file provided' }
  }

  // Auth check
  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, error: authError ?? 'Not authenticated' }
  }

  // Verify the actual file type from its bytes before storing anything — the
  // client-supplied MIME is untrusted, and a file that is not a PDF or image
  // would only fail later at the AI with a vaguer error.
  const arrayBuffer = await file.arrayBuffer()
  const mediaType = sniffMediaType(arrayBuffer)
  if (!mediaType) {
    return { success: false, error: UNSUPPORTED_FILE_MESSAGE }
  }

  // Counted only now that the file is valid and the model call follows.
  const quota = await takeAiRequest(user.id)
  if (!quota.ok) return { success: false, error: quota.error }

  // Upload to Supabase Storage via admin client
  const storagePath = `${user.id}/${crypto.randomUUID()}.${extensionFor(mediaType)}`
  const { error: uploadError } = await supabaseAdmin.storage
    .from('lab-pdfs')
    .upload(storagePath, arrayBuffer, {
      contentType: mediaType,
      upsert: false,
    })

  if (uploadError) {
    return { success: false, error: `Upload failed: ${uploadError.message}` }
  }

  // Send to Claude for extraction + matching (shared with the chat indexing registry)
  try {
    const { parseBloodBytes } = await import('@/lib/extraction/parse')
    const { result, matchedMarkers } = await parseBloodBytes(
      Buffer.from(arrayBuffer),
      mediaType,
      supabase
    )
    return { success: true, data: result, matched_markers: matchedMarkers, storage_path: storagePath }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Extraction failed unexpectedly',
      storage_path: storagePath,
    }
  }
}

export async function getPdfSignedUrl(
  storagePath: string
): Promise<{ url: string } | { url: null; error: string }> {
  const { user, authError } = await getSessionUser()

  if (!user) {
    return { url: null, error: authError ?? 'Not authenticated' }
  }

  // Verify the path belongs to this user
  if (!storagePath.startsWith(`${user.id}/`)) {
    return { url: null, error: 'Unauthorized' }
  }

  const { data, error } = await supabaseAdmin.storage
    .from('lab-pdfs')
    .createSignedUrl(storagePath, 3600) // 1 hour

  if (error || !data?.signedUrl) {
    return { url: null, error: error?.message ?? 'Failed to generate URL' }
  }

  return { url: data.signedUrl }
}
