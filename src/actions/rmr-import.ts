'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { isOwnedPath } from '@/lib/supabase/storage-path'
import { takeAiRequest } from '@/lib/ai/quota'
import { aiFailureMessage, isAiConfigured } from '@/lib/ai/config'
import { AI_NOT_CONFIGURED_MESSAGE } from '@/lib/ai/messages'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { userErrorMessage } from '@/lib/supabase/errors'
import { parseRmrBytes } from '@/lib/rmr/parse'
import {
  sniffMediaType,
  UNSUPPORTED_FILE_MESSAGE,
  type MediaType,
} from '@/lib/health-documents/media-type'
import { rmrExtractionSchema, type RmrExtraction } from '@/lib/validations/rmr-import'

const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

const MAX_FILES = 3 // an RMR test is usually a single report

export type RmrExtractionResponse =
  | { success: true; data: RmrExtraction; storagePath?: string }
  | { success: false; error: string }

/**
 * Extract an RMR test from an uploaded PDF/image via Claude and stash the source
 * file. Returns a draft for the user to review — never auto-saves.
 */
export async function extractRmrReport(
  formData: FormData
): Promise<RmrExtractionResponse> {
  const files = formData.getAll('file').filter((f): f is File => f instanceof File)
  if (files.length === 0 || !files.every((f) => ACCEPTED_TYPES.has(f.type))) {
    return { success: false, error: 'No valid PDF or image file(s) provided' }
  }
  if (files.length > MAX_FILES) {
    return { success: false, error: `Upload at most ${MAX_FILES} files per test.` }
  }

  const { user, authError } = await getSessionUser()
  if (!user) return { success: false, error: authError ?? 'Not authenticated' }
  if (!isAiConfigured()) return { success: false, error: AI_NOT_CONFIGURED_MESSAGE }

  const buffers = await Promise.all(files.map((f) => f.arrayBuffer()))

  // Verify the actual file type from leading bytes — the client-supplied MIME
  // is untrusted and could route arbitrary content to the AI extraction path.
  const sniffedTypes: MediaType[] = []
  for (const buf of buffers) {
    const t = sniffMediaType(buf)
    if (!t) {
      return {
        success: false,
        error: UNSUPPORTED_FILE_MESSAGE,
      }
    }
    sniffedTypes.push(t)
  }

  // One test can be uploaded as several files (e.g. summary + raw printout);
  // the first sniffed type drives the content blocks. parseRmrBytes accepts a
  // single buffer or a list of same-type buffers.
  const primaryType = sniffedTypes[0]
  if (!sniffedTypes.every((t) => t === primaryType)) {
    return { success: false, error: 'Please upload files of a single type per test.' }
  }

  // Counted only now that the file is valid and the model call follows.
  const quota = await takeAiRequest(user.id)
  if (!quota.ok) return { success: false, error: quota.error }

  let data: RmrExtraction
  try {
    const bufs = buffers.map((b) => Buffer.from(b))
    data = await parseRmrBytes(bufs.length === 1 ? bufs[0] : bufs, primaryType)
  } catch (err) {
    return {
      success: false,
      error: aiFailureMessage('extractRmrReport', err),
    }
  }

  // Persist the first source file only after a usable extraction (no orphans on
  // failure). Use the sniffed type (not the client-supplied one) for the ext.
  const ext =
    primaryType === 'application/pdf'
      ? 'pdf'
      : primaryType.split('/')[1].replace('jpeg', 'jpg')
  const storagePath = `${user.id}/rmr/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await supabaseAdmin.storage
    .from('lab-pdfs')
    .upload(storagePath, buffers[0], { contentType: primaryType, upsert: false })

  if (uploadError) {
    // Non-fatal — the extraction is still usable without the stored source —
    // but log so recurring upload failures are visible (mirrors the read paths).
    console.error('RMR source upload failed:', uploadError.message)
  }

  return { success: true, data, storagePath: uploadError ? undefined : storagePath }
}

export type SaveRmrTestResponse =
  | { success: true; testId: string }
  | { success: false; error: string }

/**
 * Persist a reviewed RMR extraction: insert one rmr_tests row, return its id.
 * This is the registry `persist` target and the manual-add submit target.
 */
export async function saveRmrTest(args: {
  extraction: RmrExtraction
  storagePath?: string
  source?: 'import' | 'manual' | 'summary'
}): Promise<SaveRmrTestResponse> {
  const parsed = rmrExtractionSchema.safeParse(args.extraction)
  if (!parsed.success) return { success: false, error: 'Invalid RMR data' }

  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { success: false, error: authError ?? 'Not authenticated' }
  if (args.storagePath && !isOwnedPath(user.id, args.storagePath)) {
    return { success: false, error: 'This file is not authorized for your account.' }
  }

  const t = parsed.data.test
  const { data, error } = await supabase
    .from('rmr_tests')
    .insert({
      user_id: user.id,
      test_date: t.test_date,
      provider: t.provider,
      rmr_kcal: t.rmr_kcal,
      predicted_rmr_kcal: t.predicted_rmr_kcal,
      rer: t.rer,
      fuel_carb_pct: t.fuel_carb_pct,
      fuel_fat_pct: t.fuel_fat_pct,
      source: args.source ?? 'import',
      pdf_storage_path: args.storagePath ?? null,
    })
    .select('id')
    .single()
  if (error || !data) {
    return {
      success: false,
      error: userErrorMessage('saveRmrTest', error, 'Could not save the RMR test. Please try again.'),
    }
  }

  revalidatePath('/body')
  return { success: true, testId: data.id as string }
}
