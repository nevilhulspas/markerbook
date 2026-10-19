'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/session'
import type { ActivityLevel, RmrTest } from '@/lib/database.types'
import type { RmrTestExtract } from '@/lib/validations/rmr-import'

/** The signed-in user's activity level (for TDEE derivation), or null. */
export async function getProfileActivityLevel(): Promise<ActivityLevel | null> {
  const { supabase, user } = await getSessionUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('activity_level')
    .eq('id', user.id)
    .maybeSingle()
  return (
    ((data as { activity_level?: ActivityLevel | null } | null)?.activity_level as
      | ActivityLevel
      | null) ?? null
  )
}

/** All of the signed-in user's RMR tests, newest first (RLS scopes to owner). */
export async function getRmrTests(): Promise<RmrTest[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('rmr_tests')
    .select('*')
    .order('test_date', { ascending: false })
  // Throw rather than return [] so the page shows an error instead of
  // "no data" (dashboard error.tsx).
  if (error) {
    console.error('getRmrTests failed:', error.message)
    throw new Error(`Could not load your data (getRmrTests): ${error.message}`)
  }
  return (data ?? []) as RmrTest[]
}

/** One RMR test, or null if not found / not owned (RLS-scoped). */
export async function getRmrTest(id: string): Promise<RmrTest | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('rmr_tests')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return (data as RmrTest | null) ?? null
}

/** The editable columns of an RMR test (manual edit form). */
export type RmrTestPatch = Partial<RmrTestExtract> & { notes?: string | null }

/** Update an RMR test's fields. */
export async function updateRmrTest(
  id: string,
  patch: RmrTestPatch
): Promise<{ error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'Not authenticated' }

  const { error } = await supabase
    .from('rmr_tests')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/body')
  revalidatePath(`/body/rmr/${id}`)
  return { error: null }
}

export async function deleteRmrTest(id: string): Promise<{ error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'Not authenticated' }

  const { error } = await supabase.from('rmr_tests').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/body')
  return { error: null }
}
