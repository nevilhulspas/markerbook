'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { isOwnedPath } from '@/lib/supabase/storage-path'
import { cleanCatalogText, creatorFields } from '@/lib/catalog/shared-catalog'
import { takeAiRequest } from '@/lib/ai/quota'
import { aiFailureMessage, isAiConfigured } from '@/lib/ai/config'
import { AI_NOT_CONFIGURED_MESSAGE } from '@/lib/ai/messages'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { userErrorMessage } from '@/lib/supabase/errors'
import {
  extensionFor,
  sniffMediaType,
  UNSUPPORTED_FILE_MESSAGE,
} from '@/lib/health-documents/media-type'
import {
  microbiomeExtractionSchema,
  type MicrobiomeExtraction,
} from '@/lib/validations/microbiome-import'

const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

const SAVE_FAILED = 'Could not save the microbiome test. Please try again.'

export type MicrobiomeExtractionResponse =
  | { success: true; data: MicrobiomeExtraction; storagePath?: string }
  | { success: false; error: string }

export async function extractMicrobiomeReport(
  formData: FormData
): Promise<MicrobiomeExtractionResponse> {
  const file = formData.get('file') as File | null
  if (!file || !ACCEPTED_TYPES.has(file.type)) {
    return { success: false, error: 'No valid PDF or image file provided' }
  }

  const { user, authError } = await getSessionUser()
  if (!user) return { success: false, error: authError ?? 'Not authenticated' }
  if (!isAiConfigured()) return { success: false, error: AI_NOT_CONFIGURED_MESSAGE }

  // Verify the actual file type from its bytes — the client-supplied MIME is
  // untrusted, and a file that is not a PDF or image would only fail at the AI
  // with a vaguer error.
  const arrayBuffer = await file.arrayBuffer()
  const mediaType = sniffMediaType(arrayBuffer)
  if (!mediaType) {
    return { success: false, error: UNSUPPORTED_FILE_MESSAGE }
  }

  // Counted only now that the file is valid and the model call follows.
  const quota = await takeAiRequest(user.id)
  if (!quota.ok) return { success: false, error: quota.error }

  // Extract first — only persist the file to storage once we have a usable
  // result, so failed extractions don't leave orphaned objects in the bucket.
  let data: MicrobiomeExtraction
  try {
    const { parseMicrobiomeBytes } = await import('@/lib/microbiome/parse')
    data = await parseMicrobiomeBytes(Buffer.from(arrayBuffer), mediaType)
  } catch (err) {
    return {
      success: false,
      error: aiFailureMessage('extractMicrobiomeReport', err),
    }
  }

  // Extraction succeeded — now persist the source file. A storage failure
  // here shouldn't lose the parsed data, so we still return success without
  // a path (the test just won't have its source PDF attached).
  const storagePath = `${user.id}/microbiome/${crypto.randomUUID()}.${extensionFor(mediaType)}`
  const { error: uploadError } = await supabaseAdmin.storage
    .from('lab-pdfs')
    .upload(storagePath, arrayBuffer, { contentType: mediaType, upsert: false })

  return {
    success: true,
    data,
    storagePath: uploadError ? undefined : storagePath,
  }
}

export async function saveMicrobiomeReport(input: {
  extraction: MicrobiomeExtraction
  storagePath?: string
}): Promise<
  | { success: true; testId: string; error: null }
  | { success: false; testId: null; error: string }
> {
  const parsed = microbiomeExtractionSchema.safeParse(input.extraction)
  if (!parsed.success) {
    return { success: false, testId: null, error: 'Invalid extraction payload' }
  }
  const { test, scores } = parsed.data
  // Taxa are a shared catalogue: only clean, length-limited names go in.
  const results = parsed.data.results.flatMap((r) => {
    const name = cleanCatalogText(r.name)
    return name ? [{ ...r, name }] : []
  })

  const { user, authError } = await getSessionUser()
  if (!user) return { success: false, testId: null, error: authError ?? 'Not authenticated' }
  if (input.storagePath && !isOwnedPath(user.id, input.storagePath)) {
    return { success: false, testId: null, error: 'This file is not authorized for your account.' }
  }

  // 1. Resolve / create taxa, keyed by (name, rank). Existing taxa are never
  // changed here; a new one is inserted with this report's category.
  const { data: existingTaxa } = await supabaseAdmin
    .from('microbiome_taxa')
    .select('id, name, rank')

  const taxonKey = (name: string, rank: string) =>
    `${name.toLowerCase()}::${rank}`
  const taxonId = new Map<string, string>()
  for (const t of existingTaxa ?? []) {
    taxonId.set(taxonKey(t.name, t.rank), t.id)
  }

  const toCreate = results.filter(
    (r) => !taxonId.has(taxonKey(r.name, r.rank))
  )
  // Deduplicate new taxa within this report.
  const newTaxaMap = new Map<
    string,
    { name: string; rank: string; category: string | null; created_by?: string }
  >()
  const creator = await creatorFields(supabaseAdmin, user.id)
  for (const r of toCreate) {
    const key = taxonKey(r.name, r.rank)
    if (!newTaxaMap.has(key)) {
      newTaxaMap.set(key, {
        name: r.name,
        rank: r.rank,
        category: r.category ?? null,
        ...creator,
      })
    }
  }

  if (newTaxaMap.size > 0) {
    // ON CONFLICT DO NOTHING: a taxon another import added meanwhile keeps its
    // own fields. Those rows are not returned, so read their ids afterwards.
    const { data: created, error: createErr } = await supabaseAdmin
      .from('microbiome_taxa')
      .upsert(Array.from(newTaxaMap.values()), {
        onConflict: 'name,rank',
        ignoreDuplicates: true,
      })
      .select('id, name, rank')
    if (createErr) {
      return { success: false, testId: null, error: userErrorMessage('saveMicrobiomeReport taxa', createErr, SAVE_FAILED) }
    }
    for (const t of created ?? []) {
      taxonId.set(taxonKey(t.name, t.rank), t.id)
    }
    const missing = Array.from(newTaxaMap.values()).filter(
      (t) => !taxonId.has(taxonKey(t.name, t.rank))
    )
    if (missing.length > 0) {
      const { data: raced } = await supabaseAdmin
        .from('microbiome_taxa')
        .select('id, name, rank')
        .in('name', missing.map((t) => t.name))
      for (const t of raced ?? []) {
        taxonId.set(taxonKey(t.name, t.rank), t.id)
      }
    }
  }

  // 2. Create the test.
  const { data: createdTest, error: testErr } = await supabaseAdmin
    .from('microbiome_tests')
    .insert({
      user_id: user.id,
      name: test.name,
      test_date: test.test_date,
      lab_name: test.lab_name,
      sample_type: test.sample_type ?? 'stool',
      pdf_storage_path: input.storagePath ?? null,
    })
    .select('id')
    .single()
  if (testErr || !createdTest) {
    return {
      success: false,
      testId: null,
      error: userErrorMessage('saveMicrobiomeReport test', testErr, SAVE_FAILED),
    }
  }

  // 3. Insert results (dedupe by taxon — keep first occurrence).
  const seenTaxa = new Set<string>()
  const resultRows = []
  for (const r of results) {
    const id = taxonId.get(taxonKey(r.name, r.rank))
    if (!id || seenTaxa.has(id)) continue
    seenTaxa.add(id)
    resultRows.push({
      microbiome_test_id: createdTest.id,
      taxon_id: id,
      value: r.value,
      unit: r.unit,
      ref_low: r.ref_low,
      ref_high: r.ref_high,
      status: r.status,
      raw_label: r.raw_label,
    })
  }
  if (resultRows.length > 0) {
    const { error } = await supabaseAdmin
      .from('microbiome_results')
      .insert(resultRows)
    if (error) {
      await supabaseAdmin
        .from('microbiome_tests')
        .delete()
        .eq('id', createdTest.id)
      return { success: false, testId: null, error: userErrorMessage('saveMicrobiomeReport results', error, SAVE_FAILED) }
    }
  }

  // 4. Insert scores (dedupe by name).
  const seenScores = new Set<string>()
  const scoreRows = []
  for (const s of scores) {
    if (seenScores.has(s.name)) continue
    seenScores.add(s.name)
    scoreRows.push({
      microbiome_test_id: createdTest.id,
      name: s.name,
      value: s.value,
      unit: s.unit,
      ref_low: s.ref_low,
      ref_high: s.ref_high,
      status: s.status,
      description: s.description,
    })
  }
  if (scoreRows.length > 0) {
    const { error: scoreErr } = await supabaseAdmin
      .from('microbiome_scores')
      .insert(scoreRows)
    if (scoreErr) {
      // Roll back the whole test (cascades results + scores) so we don't
      // leave a partially-imported test that silently shows no scores.
      await supabaseAdmin
        .from('microbiome_tests')
        .delete()
        .eq('id', createdTest.id)
      return { success: false, testId: null, error: userErrorMessage('saveMicrobiomeReport scores', scoreErr, SAVE_FAILED) }
    }
  }

  revalidatePath('/microbiome')
  return { success: true, testId: createdTest.id, error: null }
}
