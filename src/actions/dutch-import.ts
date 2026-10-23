'use server'

import { getSessionUser } from '@/lib/supabase/session'
import { takeAiRequest } from '@/lib/ai/quota'
import { aiFailureMessage, isAiConfigured } from '@/lib/ai/config'
import { AI_NOT_CONFIGURED_MESSAGE } from '@/lib/ai/messages'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { DutchExtractionResponse } from '@/lib/dutch/types'
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

export async function extractDutchPdf(
  formData: FormData
): Promise<DutchExtractionResponse> {
  const file = formData.get('pdf') as File | null
  if (!file || !ACCEPTED_TYPES.has(file.type)) {
    return { success: false, error: 'No valid PDF or image file provided' }
  }

  // Auth check
  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, error: authError ?? 'Not authenticated' }
  }
  if (!isAiConfigured()) return { success: false, error: AI_NOT_CONFIGURED_MESSAGE }

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
    console.error('extractDutchPdf upload failed:', uploadError.message)
    return { success: false, error: 'Could not upload the file. Please try again.' }
  }

  // Send to Claude for extraction + matching via the shared DUTCH parse helper.
  try {
    const { parseDutchBytes } = await import('@/lib/dutch/parse')
    const { result, matchedMarkers } = await parseDutchBytes(Buffer.from(arrayBuffer), mediaType, supabase)
    return { success: true, data: result, matched_markers: matchedMarkers, storage_path: storagePath }
  } catch (err) {
    return {
      success: false,
      error: aiFailureMessage('extractDutchPdf', err),
      storage_path: storagePath,
    }
  }
}
