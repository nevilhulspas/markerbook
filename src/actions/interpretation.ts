'use server'

import { getSessionUser } from '@/lib/supabase/session'
import { userErrorMessage } from '@/lib/supabase/errors'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { CachedInterpretation, InterpretationType } from '@/lib/interpretation/types'

// --- getCachedInterpretation ---

interface CacheLookupParams {
  bloodTestId: string
  testResultId?: string
  type: InterpretationType
  profileHash: string
  markerContextHash: string
}

type CacheResult =
  | { data: CachedInterpretation; stale: false }
  | { data: CachedInterpretation; stale: true }
  | { data: null; stale: false }
  | { error: string }

export async function getCachedInterpretation(
  params: CacheLookupParams
): Promise<CacheResult> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { error: authError ?? 'Not authenticated' }
  }

  let query = supabase
    .from('interpretations')
    .select('*')
    .eq('blood_test_id', params.bloodTestId)
    .eq('type', params.type)

  if (params.testResultId) {
    query = query.eq('test_result_id', params.testResultId)
  } else {
    query = query.is('test_result_id', null)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    return {
      error: userErrorMessage(
        'getCachedInterpretation',
        error,
        'Could not load the interpretation. Please try again.'
      ),
    }
  }

  if (!data) {
    return { data: null, stale: false }
  }

  const interpretation = data as CachedInterpretation

  // Check if cached interpretation is still fresh
  const hashesMatch =
    interpretation.profile_hash === params.profileHash &&
    interpretation.marker_context_hash === params.markerContextHash

  if (hashesMatch) {
    return { data: interpretation, stale: false }
  }

  return { data: interpretation, stale: true }
}

// --- saveInterpretation ---

const INTERPRETATION_TYPES: InterpretationType[] = ['single_marker', 'full_test', 'biomarker_insight']
/** Far above a real interpretation; stops the cache being used as storage. */
const MAX_CONTENT_CHARS = 100_000

interface SaveParams {
  bloodTestId: string
  testResultId?: string
  type: InterpretationType
  content: string
  profileHash: string
  markerContextHash: string
  model: string
}

export async function saveInterpretation(
  params: SaveParams
): Promise<{ success: true } | { success: false; error: string }> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, error: authError ?? 'Not authenticated' }
  }

  if (!INTERPRETATION_TYPES.includes(params.type) || params.content.length > MAX_CONTENT_CHARS) {
    return { success: false, error: 'Invalid interpretation' }
  }

  // The rows are written with the service role, so check that the test (and
  // result) are the caller's own before attaching anything to them.
  const { data: test } = await supabase
    .from('blood_tests')
    .select('id')
    .eq('id', params.bloodTestId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!test) return { success: false, error: 'Test not found' }
  if (params.testResultId) {
    const { data: result } = await supabase
      .from('test_results')
      .select('id')
      .eq('id', params.testResultId)
      .eq('blood_test_id', params.bloodTestId)
      .maybeSingle()
    if (!result) return { success: false, error: 'Result not found' }
  }

  // Delete any existing interpretation for this combination
  let deleteQuery = supabaseAdmin
    .from('interpretations')
    .delete()
    .eq('user_id', user.id)
    .eq('blood_test_id', params.bloodTestId)
    .eq('type', params.type)

  if (params.testResultId) {
    deleteQuery = deleteQuery.eq('test_result_id', params.testResultId)
  } else {
    deleteQuery = deleteQuery.is('test_result_id', null)
  }

  const { error: deleteError } = await deleteQuery

  if (deleteError) {
    return {
      success: false,
      error: userErrorMessage(
        'saveInterpretation delete',
        deleteError,
        'Could not save the interpretation. Please try again.'
      ),
    }
  }

  // Insert new interpretation via admin client
  const { error: insertError } = await supabaseAdmin
    .from('interpretations')
    .insert({
      user_id: user.id,
      blood_test_id: params.bloodTestId,
      test_result_id: params.testResultId ?? null,
      type: params.type,
      content: params.content,
      profile_hash: params.profileHash,
      marker_context_hash: params.markerContextHash,
      model: params.model,
    })

  if (insertError) {
    return {
      success: false,
      error: userErrorMessage(
        'saveInterpretation insert',
        insertError,
        'Could not save the interpretation. Please try again.'
      ),
    }
  }

  return { success: true }
}

// --- getAnalyzedTestIds ---

export async function getAnalyzedTestIds(): Promise<Set<string>> {
  const { supabase, user } = await getSessionUser()

  if (!user) return new Set()

  const { data } = await supabase
    .from('interpretations')
    .select('blood_test_id')
    .eq('type', 'full_test')

  if (!data) return new Set()
  return new Set(data.map((row) => row.blood_test_id))
}
