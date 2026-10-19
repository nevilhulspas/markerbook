'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  dutchTestSchema,
  dutchTestWithMarkersSchema,
} from '@/lib/validations/dutch-test'
import { computeDutchRatios } from '@/lib/dutch/computed-ratios'
import type {
  Biomarker,
  DutchComputedValue,
  DutchTest,
  DutchTestResult,
} from '@/lib/database.types'

export interface DutchTestWithCount extends DutchTest {
  result_count: number
}

export interface DutchTestResultWithBiomarker extends DutchTestResult {
  biomarkers: Biomarker
}

export interface DutchTestDetail extends DutchTest {
  dutch_test_results: DutchTestResultWithBiomarker[]
  dutch_computed_values: DutchComputedValue[]
}

export async function getDutchTests(): Promise<
  { data: DutchTestWithCount[]; error: null } | { data: null; error: string }
> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { data: null, error: authError ?? 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('dutch_tests')
    .select('*, dutch_test_results(id)')
    .order('test_date', { ascending: false })

  if (error) {
    return { data: null, error: error.message }
  }

  const testsWithCount: DutchTestWithCount[] = (data ?? []).map((test) => {
    const { dutch_test_results, ...rest } = test
    return {
      ...(rest as DutchTest),
      result_count: Array.isArray(dutch_test_results)
        ? dutch_test_results.length
        : 0,
    }
  })

  return { data: testsWithCount, error: null }
}

export async function deleteDutchTest(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, error: authError ?? 'Not authenticated' }
  }

  // Verify ownership via RLS read
  const { data: existing } = await supabase
    .from('dutch_tests')
    .select('id')
    .eq('id', id)
    .single()

  if (!existing) {
    return { success: false, error: 'Test not found' }
  }

  const { error } = await supabaseAdmin
    .from('dutch_tests')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/dutch')
  return { success: true, error: null }
}

export async function updateDutchTest(
  id: string,
  values: unknown
): Promise<{ success: boolean; error: string | null }> {
  const parsed = dutchTestSchema.safeParse(values)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    return { success: false, error: `Invalid: ${issues}` }
  }

  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, error: authError ?? 'Not authenticated' }
  }

  const { data: existing } = await supabase
    .from('dutch_tests')
    .select('id')
    .eq('id', id)
    .single()

  if (!existing) {
    return { success: false, error: 'Test not found' }
  }

  const { error } = await supabaseAdmin
    .from('dutch_tests')
    .update({
      name: parsed.data.name,
      test_date: parsed.data.test_date,
      menstrual_phase: parsed.data.menstrual_phase ?? null,
      cycle_day: parsed.data.cycle_day ?? null,
      notes: parsed.data.notes ?? null,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/dutch')
  revalidatePath(`/dutch/${id}`)
  return { success: true, error: null }
}

export async function createDutchTest(
  values: unknown
): Promise<
  | { success: true; testId: string; error: null }
  | { success: false; testId: null; error: string }
> {
  const parsed = dutchTestWithMarkersSchema.safeParse(values)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    return {
      success: false,
      testId: null,
      error: `Invalid DUTCH test data: ${issues}`,
    }
  }

  const { user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, testId: null, error: authError ?? 'Not authenticated' }
  }

  // Deduplicate: same biomarker_id + same timepoint (or both null) = duplicate
  const seen = new Set<string>()
  for (const marker of parsed.data.markers) {
    const key = `${marker.biomarker_id}:${marker.timepoint === 'none' ? 'null' : marker.timepoint}`
    if (seen.has(key)) {
      return {
        success: false,
        testId: null,
        error:
          'Duplicate marker detected. Each biomarker/timepoint combination can only appear once.',
      }
    }
    seen.add(key)
  }

  // Insert dutch_tests row
  const { data: test, error: testError } = await supabaseAdmin
    .from('dutch_tests')
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      test_date: parsed.data.test_date,
      menstrual_phase: parsed.data.menstrual_phase ?? null,
      cycle_day: parsed.data.cycle_day ?? null,
      notes: parsed.data.notes ?? null,
      pdf_storage_path: parsed.data.pdf_storage_path ?? null,
    })
    .select('id')
    .single()

  if (testError || !test) {
    return {
      success: false,
      testId: null,
      error: testError?.message ?? 'Failed to create DUTCH test',
    }
  }

  // Insert dutch_test_results rows
  const resultRows = parsed.data.markers.map((marker) => ({
    dutch_test_id: test.id,
    biomarker_id: marker.biomarker_id,
    value: marker.value,
    unit: marker.unit,
    timepoint: marker.timepoint === 'none' ? null : marker.timepoint,
  }))

  const { error: resultsError } = await supabaseAdmin
    .from('dutch_test_results')
    .insert(resultRows)

  if (resultsError) {
    // Clean up the test if results fail
    await supabaseAdmin.from('dutch_tests').delete().eq('id', test.id)
    return {
      success: false,
      testId: null,
      error: resultsError.message || 'Failed to save marker results',
    }
  }

  // Fetch biomarker names for ratio computation
  const biomarkerIds = [
    ...new Set(parsed.data.markers.map((m) => m.biomarker_id)),
  ]
  const { data: biomarkers } = await supabaseAdmin
    .from('dutch_markers')
    .select('id, name')
    .in('id', biomarkerIds)

  const nameMap = new Map(biomarkers?.map((b) => [b.id, b.name]) ?? [])
  const resultsWithNames = parsed.data.markers.map((m) => ({
    biomarker_name: nameMap.get(m.biomarker_id) ?? '',
    biomarker_id: m.biomarker_id,
    value: m.value,
    timepoint: m.timepoint === 'none' ? null : m.timepoint,
  }))

  // Compute ratios
  const computedRatios = computeDutchRatios(resultsWithNames)

  if (computedRatios.length > 0) {
    const computedRows = computedRatios.map((ratio) => ({
      dutch_test_id: test.id,
      name: ratio.name,
      value: ratio.value,
      unit: ratio.unit,
      formula: ratio.formula,
      source_marker_ids: ratio.source_marker_ids,
    }))

    const { error: computedError } = await supabaseAdmin
      .from('dutch_computed_values')
      .insert(computedRows)

    if (computedError) {
      console.error('Failed to insert computed values:', computedError.message)
      // Non-fatal: test + results are saved, computed values are a bonus
    }
  }

  revalidatePath('/dutch')
  return { success: true, testId: test.id, error: null }
}

export async function getDutchTestDetail(
  id: string
): Promise<
  { data: DutchTestDetail; error: null } | { data: null; error: string }
> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { data: null, error: authError ?? 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('dutch_tests')
    .select(
      // DUTCH markers live in their own catalog (dutch_markers); alias the embed back
      // to `biomarkers` so the result shape (DutchTestResultWithBiomarker) is unchanged.
      '*, dutch_test_results(*, biomarkers:dutch_markers(*)), dutch_computed_values(*)'
    )
    .eq('id', id)
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  // Narrowing cast: the hand-written DUTCH types are stricter than the schema.
  return { data: data as DutchTestDetail, error: null }
}
