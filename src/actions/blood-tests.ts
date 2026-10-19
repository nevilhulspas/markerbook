'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

import {
  bloodTestSchema,
  markerEntrySchema,
} from '@/lib/validations/blood-test'
import {
  buildResultRows,
  fetchCanonicalUnits,
  resolveMarkerEntries,
  toCanonicalUnit,
  type ResolvedMarker,
} from '@/lib/blood-tests/resolve-entries'
import type {
  Biomarker,
  BiomarkerUnit,
  BloodTest,
  PanelWithSystem,
  ReferenceRange,
  TestResult,
} from '@/lib/database.types'

const DUPLICATE_BIOMARKER_ERROR =
  'Each biomarker can only be saved once per test. Remove duplicate selections and try again.'

function hasDuplicateBiomarker(markers: ResolvedMarker[]): boolean {
  const ids = markers.map((marker) => marker.biomarker_id)
  return new Set(ids).size !== ids.length
}

export interface BiomarkerWithRelations extends Biomarker {
  biomarker_units: BiomarkerUnit[]
  reference_ranges: ReferenceRange[]
  panels: PanelWithSystem | null
}

export interface BloodTestWithCount extends BloodTest {
  result_count: number
}

export interface BloodTestWithResults extends BloodTest {
  test_results: (TestResult & { biomarkers: Biomarker })[]
}

export async function getBiomarkers(): Promise<
  | { data: BiomarkerWithRelations[]; error: null }
  | { data: null; error: string }
> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { data: null, error: authError ?? 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('biomarkers')
    .select('*, biomarker_units(*), reference_ranges(*), panels(*, systems(*))')
    .is('archived_at', null)
    .order('category')
    .order('name')

  // No fallback to a plain select: markers without their ranges and units
  // would look valid but show no status colours or conversions. The pages
  // calling this already show the error.
  if (error) {
    console.error('getBiomarkers failed:', error.message)
    return { data: null, error: error.message }
  }

  // Narrowing cast: the generated types read CHECK-constrained text columns
  // (reference_ranges.sex, biomarkers.range_source) as plain `string`; the
  // hand-written types use the literal unions.
  return { data: data as BiomarkerWithRelations[], error: null }
}

export async function getBloodTests(): Promise<
  { data: BloodTestWithCount[]; error: null } | { data: null; error: string }
> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { data: null, error: authError ?? 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('blood_tests')
    .select('*, test_results(id)')
    .order('test_date', { ascending: false })

  if (error) {
    return { data: null, error: error.message }
  }

  const testsWithCount: BloodTestWithCount[] = (data ?? []).map((test) => {
    const { test_results, ...rest } = test
    return {
      ...(rest as BloodTest),
      result_count: Array.isArray(test_results) ? test_results.length : 0,
    }
  })

  return { data: testsWithCount, error: null }
}

export async function getBloodTest(
  id: string
): Promise<
  { data: BloodTestWithResults; error: null } | { data: null; error: string }
> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { data: null, error: authError ?? 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('blood_tests')
    .select('*, test_results(*, biomarkers(*))')
    .eq('id', id)
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  // Narrowing cast: the generated types read CHECK-constrained text columns
  // (sample_type, biomarkers.range_source) as plain `string`; the hand-written
  // types use the literal unions.
  return { data: data as BloodTestWithResults, error: null }
}

export async function createBloodTest(
  values: unknown
): Promise<
  | { success: true; testId: string; error: null }
  | { success: false; testId: null; error: string }
> {
  const parsed = bloodTestSchema.safeParse(values)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    return {
      success: false,
      testId: null,
      error: `Invalid blood test data: ${issues}`,
    }
  }

  const { user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, testId: null, error: authError ?? 'Not authenticated' }
  }

  // Commit capturable markers (those with a LOINC code but no biomarker id yet).
  // A shared LOINC code is committed once; the per-test biomarker-id
  // uniqueness check below then surfaces the duplicate cleanly.
  const resolved = await resolveMarkerEntries(parsed.data.markers, { dedupeLoincCodes: true })
  if (resolved.error !== null) {
    return { success: false, testId: null, error: resolved.error }
  }
  const resolvedMarkers = resolved.markers

  if (hasDuplicateBiomarker(resolvedMarkers)) {
    return { success: false, testId: null, error: DUPLICATE_BIOMARKER_ERROR }
  }

  const { data: test, error: testError } = await supabaseAdmin
    .from('blood_tests')
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      test_date: parsed.data.test_date,
      sample_type: parsed.data.sample_type,
      notes: parsed.data.notes ?? null,
      pdf_storage_path: parsed.data.pdf_storage_path ?? null,
    })
    .select('id')
    .single()

  if (testError || !test) {
    return {
      success: false,
      testId: null,
      error: testError?.message ?? 'Failed to create test',
    }
  }

  if (resolvedMarkers.length > 0) {
    const results = await buildResultRows(test.id, resolvedMarkers)

    const { error: resultsError } = await supabaseAdmin
      .from('test_results')
      .insert(results)

    if (resultsError) {
      await supabaseAdmin.from('blood_tests').delete().eq('id', test.id)
      return {
        success: false,
        testId: null,
        error:
          resultsError.message ||
          'Failed to save marker results',
      }
    }
  }

  revalidatePath('/tests')
  revalidatePath('/grid')
  return { success: true, testId: test.id, error: null }
}

export async function appendResultsToBloodTest(
  testId: string,
  markers: unknown
): Promise<
  | { success: true; testId: string; added: number; replaced: number; error: null }
  | { success: false; testId: null; added: 0; replaced: 0; error: string }
> {
  const parsed = z.array(markerEntrySchema).safeParse(markers)
  if (!parsed.success) {
    return {
      success: false,
      testId: null,
      added: 0,
      replaced: 0,
      error: 'Invalid markers payload',
    }
  }

  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return {
      success: false,
      testId: null,
      added: 0,
      replaced: 0,
      error: authError ?? 'Not authenticated',
    }
  }

  const { data: existing } = await supabase
    .from('blood_tests')
    .select('id')
    .eq('id', testId)
    .single()

  if (!existing) {
    return {
      success: false,
      testId: null,
      added: 0,
      replaced: 0,
      error: 'Blood test not found',
    }
  }

  // Commit capturable markers first so every entry has a biomarker_id. A
  // shared LOINC code is committed once; the payload de-dupe below then keeps
  // the last value for that biomarker.
  const resolved = await resolveMarkerEntries(parsed.data, { dedupeLoincCodes: true })
  if (resolved.error !== null) {
    return { success: false, testId: null, added: 0, replaced: 0, error: resolved.error }
  }

  // Deduplicate within the incoming payload — keep last occurrence
  const dedupedByBiomarker = new Map<string, ResolvedMarker>()
  for (const marker of resolved.markers) {
    dedupedByBiomarker.set(marker.biomarker_id, marker)
  }
  const incoming = Array.from(dedupedByBiomarker.values())

  if (incoming.length === 0) {
    return { success: true, testId, added: 0, replaced: 0, error: null }
  }

  // Find existing biomarkers on this test — overwrite their values
  const incomingIds = incoming.map((m) => m.biomarker_id)
  const { data: existingResults, error: existingResultsError } = await supabase
    .from('test_results')
    .select('id, biomarker_id')
    .eq('blood_test_id', testId)
    .in('biomarker_id', incomingIds)

  // A failed read must not look like "no existing rows": every marker would
  // then be inserted and collide with the rows already on the test.
  if (existingResultsError) {
    return {
      success: false,
      testId: null,
      added: 0,
      replaced: 0,
      error: existingResultsError.message,
    }
  }

  const existingByBiomarker = new Map<string, string>()
  for (const r of existingResults ?? []) {
    existingByBiomarker.set(r.biomarker_id, r.id)
  }

  // Normalize units against canonical biomarker_units entries
  const canonicalUnits = await fetchCanonicalUnits(incomingIds)

  let added = 0
  let replaced = 0

  const inserts: Array<{
    blood_test_id: string
    biomarker_id: string
    value: number
    unit: string
  }> = []

  for (const marker of incoming) {
    const unit = toCanonicalUnit(canonicalUnits, marker.biomarker_id, marker.unit)
    const existingId = existingByBiomarker.get(marker.biomarker_id)

    if (existingId) {
      const { error: updateError } = await supabaseAdmin
        .from('test_results')
        .update({ value: marker.value, unit })
        .eq('id', existingId)
      if (updateError) {
        return {
          success: false,
          testId: null,
          added: 0,
          replaced: 0,
          error: updateError.message,
        }
      }
      replaced++
    } else {
      inserts.push({
        blood_test_id: testId,
        biomarker_id: marker.biomarker_id,
        value: marker.value,
        unit,
      })
    }
  }

  if (inserts.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from('test_results')
      .insert(inserts)
    if (insertError) {
      return {
        success: false,
        testId: null,
        added: 0,
        replaced: 0,
        error: insertError.message,
      }
    }
    added = inserts.length
  }

  revalidatePath('/tests')
  revalidatePath(`/tests/${testId}`)
  revalidatePath('/grid')
  return { success: true, testId, added, replaced, error: null }
}

export async function updateBloodTest(
  id: string,
  values: unknown
): Promise<{ success: true; error: null } | { success: false; error: string }> {
  const parsed = bloodTestSchema.safeParse(values)
  if (!parsed.success) {
    return { success: false, error: 'Invalid blood test data' }
  }

  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, error: authError ?? 'Not authenticated' }
  }

  // Verify ownership via RLS read
  const { data: existing } = await supabase
    .from('blood_tests')
    .select('id')
    .eq('id', id)
    .single()

  if (!existing) {
    return { success: false, error: 'Test not found' }
  }

  // Resolve all capturable markers to biomarker_ids BEFORE mutating anything.
  // A capture failure must leave the test's metadata AND results untouched, so
  // every commitCapture runs first (fail-fast). Reuse the biomarker id within
  // one save when two entries share a LOINC code, so we don't fire a redundant
  // second write — the per-test uniqueness check below then rejects the
  // duplicate before the old results are deleted.
  const resolved = await resolveMarkerEntries(parsed.data.markers, { dedupeLoincCodes: true })
  if (resolved.error !== null) {
    return { success: false, error: resolved.error }
  }
  const resolvedUpdateMarkers = resolved.markers

  if (hasDuplicateBiomarker(resolvedUpdateMarkers)) {
    return { success: false, error: DUPLICATE_BIOMARKER_ERROR }
  }

  // All captures succeeded — now it's safe to mutate. Update metadata first.
  const { error: updateError } = await supabaseAdmin
    .from('blood_tests')
    .update({
      name: parsed.data.name,
      test_date: parsed.data.test_date,
      sample_type: parsed.data.sample_type,
      notes: parsed.data.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // Replace markers: delete existing, insert new
  const { error: deleteError } = await supabaseAdmin
    .from('test_results')
    .delete()
    .eq('blood_test_id', id)

  if (deleteError) {
    return { success: false, error: 'Failed to update marker results' }
  }

  if (resolvedUpdateMarkers.length > 0) {
    const results = await buildResultRows(id, resolvedUpdateMarkers)

    const { error: insertError } = await supabaseAdmin
      .from('test_results')
      .insert(results)

    if (insertError) {
      return { success: false, error: 'Failed to save marker results' }
    }
  }

  revalidatePath('/tests')
  revalidatePath('/grid')
  return { success: true, error: null }
}

export async function createBiomarker(values: {
  name: string
  category: string
  unit: string
  parent_id?: string | null
}): Promise<
  | { success: true; biomarker: Biomarker; error: null }
  | { success: false; biomarker: null; error: string }
> {
  const { user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, biomarker: null, error: authError ?? 'Not authenticated' }
  }

  const { name, category, unit } = values
  if (!name.trim() || !category.trim()) {
    return {
      success: false,
      biomarker: null,
      error: 'Name and category are required',
    }
  }

  const { data, error } = await supabaseAdmin
    .from('biomarkers')
    .insert({
      name: name.trim(),
      category: category.trim(),
      unit: unit.trim() || 'ratio',
      parent_id: values.parent_id ?? null,
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      return {
        success: false,
        biomarker: null,
        error: 'A biomarker with this name already exists',
      }
    }
    return { success: false, biomarker: null, error: error.message }
  }

  return { success: true, biomarker: data as Biomarker, error: null }
}

export async function createBiomarkers(
  values: { name: string; category: string; unit: string }[]
): Promise<
  | { success: true; biomarkers: Biomarker[]; error: null }
  | { success: false; biomarkers: null; error: string }
> {
  const { user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, biomarkers: null, error: authError ?? 'Not authenticated' }
  }

  const rows = values
    .filter((v) => v.name.trim() && v.category.trim())
    .map((v) => ({
      name: v.name.trim(),
      category: v.category.trim(),
      unit: v.unit.trim() || 'ratio',
    }))

  if (rows.length === 0) {
    return { success: false, biomarkers: null, error: 'No valid biomarkers to create' }
  }

  const created: Biomarker[] = []
  const errors: string[] = []

  for (const row of rows) {
    const { data, error } = await supabaseAdmin
      .from('biomarkers')
      .insert(row)
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        // Duplicate — fetch existing
        const { data: existing } = await supabaseAdmin
          .from('biomarkers')
          .select('*')
          .eq('name', row.name)
          .single()
        if (existing) created.push(existing as Biomarker)
        else errors.push(`${row.name}: duplicate but could not fetch`)
      } else {
        errors.push(`${row.name}: ${error.message}`)
      }
    } else {
      created.push(data as Biomarker)
    }
  }

  if (created.length === 0) {
    return {
      success: false,
      biomarkers: null,
      error: errors.join('; '),
    }
  }

  return { success: true, biomarkers: created, error: null }
}

export async function attachPdfToTest(
  testId: string,
  formData: FormData
): Promise<{ success: true; storagePath: string } | { success: false; error: string }> {
  const file = formData.get('pdf') as File | null
  const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!file || !validTypes.includes(file.type)) {
    return { success: false, error: 'No valid PDF or image file provided' }
  }

  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, error: authError ?? 'Not authenticated' }
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from('blood_tests')
    .select('id')
    .eq('id', testId)
    .single()

  if (!existing) {
    return { success: false, error: 'Test not found' }
  }

  const isImage = file.type.startsWith('image/')
  const ext = isImage ? file.type.split('/')[1].replace('jpeg', 'jpg') : 'pdf'
  const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadError } = await supabaseAdmin.storage
    .from('lab-pdfs')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return { success: false, error: `Upload failed: ${uploadError.message}` }
  }

  const { error: updateError } = await supabaseAdmin
    .from('blood_tests')
    .update({ pdf_storage_path: storagePath })
    .eq('id', testId)

  if (updateError) {
    return { success: false, error: `Failed to link PDF: ${updateError.message}` }
  }

  revalidatePath(`/tests/${testId}/edit`)
  return { success: true, storagePath }
}

export async function deleteBloodTest(
  id: string
): Promise<{ success: true; error: null } | { success: false; error: string }> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, error: authError ?? 'Not authenticated' }
  }

  // Verify ownership via RLS read
  const { data: existing } = await supabase
    .from('blood_tests')
    .select('id')
    .eq('id', id)
    .single()

  if (!existing) {
    return { success: false, error: 'Test not found' }
  }

  // Delete related interpretations first (FK constraint)
  await supabaseAdmin
    .from('interpretations')
    .delete()
    .eq('blood_test_id', id)

  // Cascade delete handles test_results
  const { error } = await supabaseAdmin
    .from('blood_tests')
    .delete()
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/tests')
  revalidatePath('/grid')
  return { success: true, error: null }
}
