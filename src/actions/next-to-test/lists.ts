'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { isUniqueViolation, userErrorMessage } from '@/lib/supabase/errors'
import type { NextToTestList } from '@/lib/database.types'
import { ensureDefaultListId } from '@/lib/next-to-test/lists'
import { NOT_SIGNED_IN, type Err } from '@/lib/next-to-test/errors'

// ---------- LISTS ----------

export async function getNextToTestLists(): Promise<NextToTestList[]> {
  const { supabase, user } = await getSessionUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('next_to_test_lists')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Could not load your next-to-test lists: ${error.message}`)
  return (data ?? []) as NextToTestList[]
}

export async function createNextToTestList(
  name: string
): Promise<{ list: NextToTestList } | Err> {
  const trimmed = name.trim()
  if (trimmed.length === 0) return { error: 'List name is required.' }

  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? NOT_SIGNED_IN }

  const insert = await supabase
    .from('next_to_test_lists')
    .insert({ user_id: user.id, name: trimmed })
    .select()
    .single()
  if (insert.error) {
    if (isUniqueViolation(insert.error)) {
      return { error: 'A list with that name already exists.' }
    }
    return {
      error: userErrorMessage(
        'createNextToTestList',
        insert.error,
        'Could not create the list. Please try again.'
      ),
    }
  }
  revalidatePath('/next-to-test')
  return { list: insert.data as NextToTestList }
}

export async function renameNextToTestList(
  id: string,
  name: string
): Promise<{ error: string | null }> {
  const trimmed = name.trim()
  if (trimmed.length === 0) return { error: 'Name is required.' }

  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? NOT_SIGNED_IN }

  const { error } = await supabase
    .from('next_to_test_lists')
    .update({ name: trimmed })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) {
    if (isUniqueViolation(error)) {
      return { error: 'A list with that name already exists.' }
    }
    return {
      error: userErrorMessage(
        'renameNextToTestList',
        error,
        'Could not rename the list. Please try again.'
      ),
    }
  }
  revalidatePath('/next-to-test')
  return { error: null }
}

export async function deleteNextToTestList(
  id: string
): Promise<{ error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? NOT_SIGNED_IN }

  const { error } = await supabase
    .from('next_to_test_lists')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) {
    return {
      error: userErrorMessage(
        'deleteNextToTestList',
        error,
        'Could not delete the list. Please try again.'
      ),
    }
  }
  revalidatePath('/next-to-test')
  return { error: null }
}

/**
 * Returns the id of the user's default "Up next" list, creating it on first call.
 * Idempotent via the per-user case-insensitive unique index on name.
 */
export async function getDefaultListId(): Promise<string> {
  const { supabase, user } = await getSessionUser()
  if (!user) throw new Error(NOT_SIGNED_IN)
  return ensureDefaultListId(supabase, user.id)
}

// ---------- SUMMARY (for the sidebar badge) ----------

export async function getNextToTestSummary(): Promise<{
  pendingCount: number
  lists: Array<{ id: string; name: string; pendingCount: number }>
}> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { pendingCount: 0, lists: [] }

  // Collapse the per-list counts and the total into one round-trip. We fetch
  // just the list_id of every pending row (RLS limits to the current user) and
  // group in JS. With M pending rows this is O(M) memory for one query,
  // vs N+2 Supabase round-trips that previously fired on every dashboard
  // layout render (sidebar badge).
  // This feeds the sidebar badge in the dashboard LAYOUT, which no error
  // boundary covers: degrade to an empty badge instead of failing every page.
  const userLists = await getNextToTestLists().catch((err: unknown) => {
    console.error('[next-to-test] lists unavailable for the sidebar badge', err)
    return []
  })
  const { data: pendingRows } = await supabase
    .from('next_to_test')
    .select('list_id')
    .eq('user_id', user.id)
    .eq('status', 'pending')
  const countByListId = new Map<string, number>()
  let total = 0
  for (const row of (pendingRows ?? []) as Array<{ list_id: string }>) {
    countByListId.set(row.list_id, (countByListId.get(row.list_id) ?? 0) + 1)
    total += 1
  }
  const perList = userLists.map((l) => ({
    id: l.id,
    name: l.name,
    pendingCount: countByListId.get(l.id) ?? 0,
  }))
  return { pendingCount: total, lists: perList }
}
