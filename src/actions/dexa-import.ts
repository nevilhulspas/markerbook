'use server'

import type Anthropic from '@anthropic-ai/sdk'
import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { isOwnedPath } from '@/lib/supabase/storage-path'
import { takeAiRequest } from '@/lib/ai/quota'
import { aiFailureMessage, isAiConfigured } from '@/lib/ai/config'
import { AI_NOT_CONFIGURED_MESSAGE } from '@/lib/ai/messages'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { userErrorMessage } from '@/lib/supabase/errors'
import { buildDexaExtractionPrompt } from '@/lib/dexa/extraction-prompt'
import { extractDocumentJson } from '@/lib/ai/extract-document'
import { applyProfileFallback } from '@/lib/dexa/parse'
import {
  sniffMediaType,
  UNSUPPORTED_FILE_MESSAGE,
  type MediaType,
} from '@/lib/health-documents/media-type'
import {
  dexaExtractionSchema,
  rawExtractionSchema,
  normalizeExtraction,
  type DexaExtraction,
} from '@/lib/validations/dexa-import'

const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

const MAX_FILES = 5 // a scan is usually 1–2 files (summary + raw printout)

export type DexaExtractionResponse =
  | { success: true; data: DexaExtraction; storagePath?: string }
  | { success: false; error: string }

/**
 * Extract a DEXA scan from an uploaded PDF/image via Claude (structured output),
 * normalize units + fill derived metrics, and stash the source file. Returns a
 * draft for the user to review — never auto-saves.
 */
export async function extractDexaReport(
  formData: FormData
): Promise<DexaExtractionResponse> {
  // One scan can be uploaded as several files (e.g. summary + raw printout);
  // they're merged into a single record by the model. The first file is kept as
  // the stored source attachment.
  const files = formData.getAll('file').filter((f): f is File => f instanceof File)
  if (files.length === 0 || !files.every((f) => ACCEPTED_TYPES.has(f.type))) {
    return { success: false, error: 'No valid PDF or image file(s) provided' }
  }
  if (files.length > MAX_FILES) {
    return { success: false, error: `Upload at most ${MAX_FILES} files per scan.` }
  }

  const { supabase, user, authError } = await getSessionUser()
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

  // Counted only now that the file is valid and the model call follows.
  const quota = await takeAiRequest(user.id)
  if (!quota.ok) return { success: false, error: quota.error }

  let data: DexaExtraction
  try {
    const fileBlocks: Anthropic.Messages.ContentBlockParam[] = files.map((_f, i) => {
      const b64 = Buffer.from(buffers[i]).toString('base64')
      const mt = sniffedTypes[i]
      return mt === 'application/pdf'
        ? {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: b64 },
          }
        : {
            type: 'image',
            source: { type: 'base64', media_type: mt, data: b64 },
          }
    })

    // Throws the same messages this action used to return; the catch below
    // turns them into { success: false, error }.
    const raw = await extractDocumentJson({
      content: [...fileBlocks, { type: 'text', text: buildDexaExtractionPrompt() }],
      maxTokens: 16384,
      schema: rawExtractionSchema,
    })
    data = normalizeExtraction(raw)

    // The DexaFit summary omits a standalone age/height (it prints DOB + total
    // mass). Fall back to the user's profile for those so the review form isn't
    // blank. Weight is left to the scan's total mass (profile weight is stale).
    if (data.scan.age_years == null || data.scan.height_cm == null) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('date_of_birth, height_cm')
        .eq('id', user.id)
        .maybeSingle()
      applyProfileFallback(data, profile as { date_of_birth: string | null; height_cm: number | null } | null)
    }
  } catch (err) {
    return {
      success: false,
      error: aiFailureMessage('extractDexaReport', err),
    }
  }

  // Persist the first source file only after a usable extraction (no orphans on
  // failure). When several files are merged, the first is the stored reference.
  // Use the sniffed type (not the client-supplied one) for content-type + ext.
  const primaryType = sniffedTypes[0]
  const ext =
    primaryType === 'application/pdf'
      ? 'pdf'
      : primaryType.split('/')[1].replace('jpeg', 'jpg')
  const storagePath = `${user.id}/dexa/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await supabaseAdmin.storage
    .from('lab-pdfs')
    .upload(storagePath, buffers[0], { contentType: primaryType, upsert: false })

  return { success: true, data, storagePath: uploadError ? undefined : storagePath }
}

export type SaveDexaScanResponse =
  | { success: true; scanId: string; error: null }
  | { success: false; scanId: null; error: string }

/**
 * Persist a reviewed DEXA extraction: insert the scan, then its regions.
 * Rolls the scan back if region insertion fails so we never leave a scan with a
 * half-written breakdown.
 */
export async function saveDexaScan(input: {
  extraction: DexaExtraction
  storagePath?: string
  source?: 'summary' | 'raw' | 'manual' | 'merged'
}): Promise<SaveDexaScanResponse> {
  const parsed = dexaExtractionSchema.safeParse(input.extraction)
  if (!parsed.success) {
    return { success: false, scanId: null, error: 'Invalid scan payload' }
  }
  const { scan, regions } = parsed.data

  const { user, authError } = await getSessionUser()
  if (!user) return { success: false, scanId: null, error: authError ?? 'Not authenticated' }
  if (input.storagePath && !isOwnedPath(user.id, input.storagePath)) {
    return { success: false, scanId: null, error: 'This file is not authorized for your account.' }
  }

  const { data: created, error: scanErr } = await supabaseAdmin
    .from('dexa_scans')
    .insert({
      user_id: user.id,
      ...scan,
      source: input.source ?? 'summary',
      pdf_storage_path: input.storagePath ?? null,
    })
    .select('id')
    .single()
  if (scanErr || !created) {
    return {
      success: false,
      scanId: null,
      error: userErrorMessage('saveDexaScan', scanErr, 'Could not save the scan. Please try again.'),
    }
  }

  if (regions.length > 0) {
    const rows = regions.map((r) => ({ scan_id: created.id, ...r }))
    const { error: regionErr } = await supabaseAdmin.from('dexa_regions').insert(rows)
    if (regionErr) {
      await supabaseAdmin.from('dexa_scans').delete().eq('id', created.id)
      return {
        success: false,
        scanId: null,
        error: userErrorMessage('saveDexaScan regions', regionErr, 'Could not save the scan. Please try again.'),
      }
    }
  }

  revalidatePath('/body')
  return { success: true, scanId: created.id as string, error: null }
}
