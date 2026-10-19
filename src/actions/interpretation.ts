'use server'

import { getSessionUser } from '@/lib/supabase/session'
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
    return { error: error.message }
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
  const { user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, error: authError ?? 'Not authenticated' }
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
    return { success: false, error: deleteError.message }
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
    return { success: false, error: insertError.message }
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
