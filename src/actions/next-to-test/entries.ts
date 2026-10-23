'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { isUniqueViolation, userErrorMessage } from '@/lib/supabase/errors'
import type { NextToTest, NextToTestStatus } from '@/lib/database.types'
import type { TableUpdate } from '@/lib/supabase/database'
import { NOT_SIGNED_IN, type Err } from '@/lib/next-to-test/errors'

export interface NextToTestEntry extends NextToTest {
  // Display-side resolved fields. Server actions populate when returning.
  biomarker_name?: string | null
  lab_test_name?: string | null
  lab_name?: string | null
}

// ---------- ENTRIES ----------

type SessionClient = Awaited<ReturnType<typeof getSessionUser>>['supabase']

/**
 * The entry's list must be one of the caller's own lists. The insert policy
 * only checks the entry's user_id, so without this a request could file an
 * entry under another user's list id.
 */
async function ownsList(supabase: SessionClient, userId: string, listId: string): Promise<boolean> {
  const { data } = await supabase
    .from('next_to_test_lists')
    .select('id')
    .eq('id', listId)
    .eq('user_id', userId)
    .maybeSingle()
  return data !== null
}

export async function getNextToTestEntries(
  listId: string,
  opts?: { status?: NextToTestStatus | 'all' }
): Promise<NextToTest[]> {
  const { supabase, user } = await getSessionUser()
  if (!user) return []

  const status = opts?.status ?? 'pending'

  if (status === 'pending') {
    const { data, error } = await supabase
      .from('next_to_test')
      .select('*')
      .eq('list_id', listId)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) throw new Error(`Could not load your next-to-test entries: ${error.message}`)
    return (data ?? []) as NextToTest[]
  }
  if (status === 'done') {
    const { data, error } = await supabase
      .from('next_to_test')
      .select('*')
      .eq('list_id', listId)
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('updated_at', { ascending: false })
    if (error) throw new Error(`Could not load your next-to-test entries: ${error.message}`)
    return (data ?? []) as NextToTest[]
  }
  // 'all': pending first (due/created), then done (updated). JS-merge two fetches.
  const [{ data: pending, error: pendingError }, { data: done, error: doneError }] = await Promise.all([
    supabase
      .from('next_to_test')
      .select('*')
      .eq('list_id', listId)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('next_to_test')
      .select('*')
      .eq('list_id', listId)
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('updated_at', { ascending: false }),
  ])
  const entriesError = pendingError ?? doneError
  if (entriesError) throw new Error(`Could not load your next-to-test entries: ${entriesError.message}`)
  return [
    ...((pending ?? []) as NextToTest[]),
    ...((done ?? []) as NextToTest[]),
  ]
}

export async function addBiomarkerToList(input: {
  listId: string
  biomarkerId: string
  note?: string
  dueDate?: string
}): Promise<{ entry: NextToTest } | Err> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? NOT_SIGNED_IN }
  if (!(await ownsList(supabase, user.id, input.listId))) return { error: 'list_not_found' }
  const insert = await supabase
    .from('next_to_test')
    .insert({
      user_id: user.id,
      list_id: input.listId,
      test_type: 'blood_biomarker',
      biomarker_id: input.biomarkerId,
      lab_test_id: null,
      note: input.note ?? null,
      due_date: input.dueDate ?? null,
      status: 'pending',
    })
    .select()
    .single()
  if (insert.error) {
    if (isUniqueViolation(insert.error)) return { error: 'duplicate' }
    return {
      error: userErrorMessage(
        'addBiomarkerToList',
        insert.error,
        'Could not add the marker to the list. Please try again.'
      ),
    }
  }
  revalidatePath('/next-to-test')
  return { entry: insert.data as NextToTest }
}

export async function addLabTestToList(input: {
  listId: string
  labTestId: string
  note?: string
  dueDate?: string
}): Promise<{ entry: NextToTest } | Err> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? NOT_SIGNED_IN }
  if (!(await ownsList(supabase, user.id, input.listId))) return { error: 'list_not_found' }
  const insert = await supabase
    .from('next_to_test')
    .insert({
      user_id: user.id,
      list_id: input.listId,
      test_type: 'blood_lab_test',
      biomarker_id: null,
      lab_test_id: input.labTestId,
      note: input.note ?? null,
      due_date: input.dueDate ?? null,
      status: 'pending',
    })
    .select()
    .single()
  if (insert.error) {
    if (isUniqueViolation(insert.error)) return { error: 'duplicate' }
    return {
      error: userErrorMessage(
        'addLabTestToList',
        insert.error,
        'Could not add the test to the list. Please try again.'
      ),
    }
  }
  revalidatePath('/next-to-test')
  return { entry: insert.data as NextToTest }
}

/**
 * Add a non-blood entry: DEXA / microbiome / DUTCH / genetic / free-text
 * 'other'. For the typed categories `customName` is the user-side label
 * (defaults to the category name in the UI if omitted); for 'other' it's
 * required because there's no implicit label.
 *
 * Returns 'invalid' when the input fails the typed→customName rules; the
 * 23505 unique violation only fires for blood rows (the partial unique
 * indexes are on biomarker_id / lab_test_id) so we don't map it here.
 */
export async function addCategoryToList(input: {
  listId: string
  testType: Exclude<NextToTest['test_type'], 'blood_biomarker' | 'blood_lab_test'>
  customName?: string
  note?: string
  dueDate?: string
}): Promise<{ entry: NextToTest } | Err> {
  // 'other' requires a custom name; blank/whitespace doesn't satisfy the
  // CHECK constraint either, so reject early with a friendly error.
  const trimmedName = input.customName?.trim() ?? ''
  if (input.testType === 'other' && trimmedName.length === 0) {
    return { error: 'A test name is required for "Other".' }
  }
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? NOT_SIGNED_IN }
  if (!(await ownsList(supabase, user.id, input.listId))) return { error: 'list_not_found' }
  const insert = await supabase
    .from('next_to_test')
    .insert({
      user_id: user.id,
      list_id: input.listId,
      test_type: input.testType,
      biomarker_id: null,
      lab_test_id: null,
      custom_name: trimmedName.length > 0 ? trimmedName : null,
      note: input.note ?? null,
      due_date: input.dueDate ?? null,
      status: 'pending',
    })
    .select()
    .single()
  if (insert.error) {
    return {
      error: userErrorMessage(
        'addCategoryToList',
        insert.error,
        'Could not add the markers to the list. Please try again.'
      ),
    }
  }
  revalidatePath('/next-to-test')
  return { entry: insert.data as NextToTest }
}

export async function updateEntry(input: {
  id: string
  note?: string | null
  dueDate?: string | null
  status?: NextToTestStatus
  listId?: string
}): Promise<{ entry: NextToTest } | Err> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? NOT_SIGNED_IN }

  const patch: TableUpdate<'next_to_test'> = {}
  if ('note' in input) patch.note = input.note
  if ('dueDate' in input) patch.due_date = input.dueDate
  if (input.status) patch.status = input.status
  if (input.listId) {
    if (!(await ownsList(supabase, user.id, input.listId))) return { error: 'list_not_found' }
    patch.list_id = input.listId
  }

  const { data, error } = await supabase
    .from('next_to_test')
    .update(patch)
    .eq('id', input.id)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) {
    if (isUniqueViolation(error)) return { error: 'duplicate' }
    return {
      error: userErrorMessage('updateEntry', error, 'Could not save the entry. Please try again.'),
    }
  }
  revalidatePath('/next-to-test')
  return { entry: data as NextToTest }
}

export async function deleteEntry(
  id: string
): Promise<{ error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? NOT_SIGNED_IN }
  const { error } = await supabase
    .from('next_to_test')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) {
    return {
      error: userErrorMessage(
        'deleteEntry',
        error,
        'Could not remove the entry. Please try again.'
      ),
    }
  }
  revalidatePath('/next-to-test')
  return { error: null }
}

// ---------- SOURCE PICKER (pin biomarker → lab_test, and back) ----------

/**
 * Pin a biomarker entry to a specific lab_test, OR re-pin a lab_test entry
 * to a different lab_test for the same biomarker. Always sets the XOR
 * correctly (biomarker_id=null, lab_test_id=X). Caller is responsible for
 * confirming the lab_test_id actually maps to the entry's biomarker.
 *
 * Returns 'duplicate' when the partial unique index on (list_id, lab_test_id)
 * would collide — the same lab test is already on the list under another
 * entry. UI should toast and skip the operation.
 */
export async function pinEntryToLab(
  entryId: string,
  labTestId: string
): Promise<{ ok: true } | { error: 'duplicate' | 'unauthorized' | string }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'unauthorized' }
  const { error } = await supabase
    .from('next_to_test')
    .update({
      test_type: 'blood_lab_test',
      biomarker_id: null,
      lab_test_id: labTestId,
    })
    .eq('id', entryId)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) {
    if (isUniqueViolation(error as { code?: string })) {
      return { error: 'duplicate' }
    }
    return {
      error: userErrorMessage(
        'pinEntryToLab',
        error,
        'Could not pin the entry to the lab. Please try again.'
      ),
    }
  }
  revalidatePath('/next-to-test')
  return { ok: true }
}

/**
 * Inverse: convert a lab_test-pinned entry back to a lab-agnostic biomarker
 * entry. Caller passes the biomarker_id to use — typically the first/only
 * biomarker the prior lab_test mapped to. For multi-biomarker lab_tests
 * (Leukogram → 6 markers) the caller decides which biomarker the entry
 * should track post-conversion.
 */
export async function unpinEntryToBiomarker(
  entryId: string,
  biomarkerId: string
): Promise<{ ok: true } | { error: 'duplicate' | 'unauthorized' | string }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'unauthorized' }
  const { error } = await supabase
    .from('next_to_test')
    .update({
      test_type: 'blood_biomarker',
      biomarker_id: biomarkerId,
      lab_test_id: null,
    })
    .eq('id', entryId)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) {
    if (isUniqueViolation(error as { code?: string })) {
      return { error: 'duplicate' }
    }
    return {
      error: userErrorMessage(
        'unpinEntryToBiomarker',
        error,
        'Could not unpin the entry. Please try again.'
      ),
    }
  }
  revalidatePath('/next-to-test')
  return { ok: true }
}
