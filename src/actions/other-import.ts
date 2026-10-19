'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { takeAiRequest } from '@/lib/ai/quota'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { parseOtherBytes } from '@/lib/other/parse'
import {
  sniffMediaType,
  UNSUPPORTED_FILE_MESSAGE,
  type MediaType,
} from '@/lib/health-documents/media-type'
import { otherExtractionSchema, type OtherExtraction } from '@/lib/validations/other-import'

const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

const MAX_FILES = 3 // an "other" test is usually a single report

export type OtherExtractionResponse =
  | { success: true; data: OtherExtraction; storagePath?: string }
  | { success: false; error: string }

/**
 * Extract an "other" test from an uploaded PDF/image via Claude and stash the
 * source file. Returns a draft for the user to review — never auto-saves.
 * Mirrors extractRmrReport.
 */
export async function extractOtherReport(
  formData: FormData
): Promise<OtherExtractionResponse> {
  const files = formData.getAll('file').filter((f): f is File => f instanceof File)
  if (files.length === 0 || !files.every((f) => ACCEPTED_TYPES.has(f.type))) {
    return { success: false, error: 'No valid PDF or image file(s) provided' }
  }
  if (files.length > MAX_FILES) {
    return { success: false, error: `Upload at most ${MAX_FILES} files per test.` }
  }

  const { user, authError } = await getSessionUser()
  if (!user) return { success: false, error: authError ?? 'Not authenticated' }

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

  const primaryType = sniffedTypes[0]
  if (!sniffedTypes.every((t) => t === primaryType)) {
    return { success: false, error: 'Please upload files of a single type per test.' }
  }

  // Counted only now that the file is valid and the model call follows.
  const quota = await takeAiRequest(user.id)
  if (!quota.ok) return { success: false, error: quota.error }

  let data: OtherExtraction
  try {
    const bufs = buffers.map((b) => Buffer.from(b))
    data = await parseOtherBytes(bufs.length === 1 ? bufs[0] : bufs, primaryType)
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Extraction failed',
    }
  }

  // Persist the first source file only after a usable extraction (no orphans on
  // failure). Use the sniffed type (not the client-supplied one) for the ext.
  const ext =
    primaryType === 'application/pdf'
      ? 'pdf'
      : primaryType.split('/')[1].replace('jpeg', 'jpg')
  const storagePath = `${user.id}/other/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await supabaseAdmin.storage
    .from('lab-pdfs')
    .upload(storagePath, buffers[0], { contentType: primaryType, upsert: false })

  if (uploadError) {
    // Non-fatal — the extraction is still usable without the stored source —
    // but log so recurring upload failures are visible (mirrors the read paths).
    console.error('Other-test source upload failed:', uploadError.message)
  }

  return { success: true, data, storagePath: uploadError ? undefined : storagePath }
}

export type SaveOtherTestResponse =
  | { success: true; testId: string }
  | { success: false; error: string }

/**
 * Persist a reviewed "other" test: insert one other_tests row plus its readings.
 * This is the registry `persist` target and the import-review save target.
 */
export async function saveOtherTest(args: {
  extraction: OtherExtraction
  storagePath?: string
  source?: 'import' | 'manual' | 'summary'
}): Promise<SaveOtherTestResponse> {
  const parsed = otherExtractionSchema.safeParse(args.extraction)
  if (!parsed.success) return { success: false, error: 'Invalid test data' }

  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { success: false, error: authError ?? 'Not authenticated' }

  const t = parsed.data.test
  const { data, error } = await supabase
    .from('other_tests')
    .insert({
      user_id: user.id,
      test_name: t.test_name,
      test_date: t.test_date,
      provider: t.provider,
      outcome: t.outcome,
      result_summary: t.result_summary,
      notes: t.notes,
      source: args.source ?? 'import',
      pdf_storage_path: args.storagePath ?? null,
    })
    .select('id')
    .single()
  if (error || !data) return { success: false, error: error?.message ?? 'Failed to save' }

  const testId = data.id as string

  const rows = parsed.data.values.map((v, i) => ({
    test_id: testId,
    label: v.label,
    value: v.value,
    unit: v.unit,
    flag: v.flag,
    sort_order: i,
  }))
  if (rows.length > 0) {
    const { error: valuesError } = await supabase.from('other_test_values').insert(rows)
    if (valuesError) {
      // Don't orphan a half-saved test — roll the parent back so the user can retry.
      await supabase.from('other_tests').delete().eq('id', testId)
      return { success: false, error: valuesError.message }
    }
  }

  revalidatePath('/other')
  return { success: true, testId }
}
