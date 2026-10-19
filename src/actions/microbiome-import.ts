'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { takeAiRequest } from '@/lib/ai/quota'
import { supabaseAdmin } from '@/lib/supabase/admin'
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
      error: err instanceof Error ? err.message : 'Extraction failed',
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
  const { test, results, scores } = parsed.data

  const { user, authError } = await getSessionUser()
  if (!user) return { success: false, testId: null, error: authError ?? 'Not authenticated' }

  // 1. Resolve / create taxa, keyed by (name, rank).
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
    { name: string; rank: string; category: string | null }
  >()
  for (const r of toCreate) {
    const key = taxonKey(r.name, r.rank)
    if (!newTaxaMap.has(key)) {
      newTaxaMap.set(key, {
        name: r.name,
        rank: r.rank,
        category: r.category ?? null,
      })
    }
  }

  if (newTaxaMap.size > 0) {
    const { data: created, error: createErr } = await supabaseAdmin
      .from('microbiome_taxa')
      .upsert(Array.from(newTaxaMap.values()), {
        onConflict: 'name,rank',
        ignoreDuplicates: false,
      })
      .select('id, name, rank')
    if (createErr) {
      return { success: false, testId: null, error: createErr.message }
    }
    for (const t of created ?? []) {
      taxonId.set(taxonKey(t.name, t.rank), t.id)
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
      error: testErr?.message ?? 'Failed to create test',
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
      return { success: false, testId: null, error: error.message }
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
      return { success: false, testId: null, error: scoreErr.message }
    }
  }

  revalidatePath('/microbiome')
  return { success: true, testId: createdTest.id, error: null }
}
