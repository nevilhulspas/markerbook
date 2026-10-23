'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { userErrorMessage } from '@/lib/supabase/errors'
import type { NextToTestStatus } from '@/lib/database.types'
import { planBulkMove, type MoveRow } from '@/lib/next-to-test/merge'
import { NOT_SIGNED_IN, type Err } from '@/lib/next-to-test/errors'

// ---------- BULK OPERATIONS ----------
//
// Used by the bulk-edit toolbar on /next-to-test. Each scoped to the
// authenticated user via the user-context client and an explicit user_id
// match — defense-in-depth on top of the RLS self-policy.

type BulkAuthErr = { error: typeof NOT_SIGNED_IN }
type BulkNoOp = { ok: true; count: 0 }

const MOVE_CHANGED = 'Some entries changed while moving. Refresh and try again.'

/**
 * Re-parent up to N entries to a different list.
 *
 * The partial unique indexes on `(list_id, biomarker_id)` and
 * `(list_id, lab_test_id)` refuse a row that would collide with the target
 * list's existing items — so colliding entries are MERGED into their target
 * twin instead of moved: the target row absorbs a pending status (pending
 * wins over done) and backfills empty note/due fields, and the source row is
 * deleted. Previously collisions were silently skipped behind a success
 * toast, which read as "the move did nothing".
 */
export async function bulkMoveEntries(
  ids: string[],
  listId: string,
  opts?: {
    /**
     * On merge, the source's note/due OVERWRITE the twin's instead of only
     * backfilling empty fields. Used by the single-row edit popover, where
     * the source row carries the user's just-typed edits — without this a
     * fresh note would silently lose to the twin's stale one.
     */
    sourceWins?: boolean
  }
): Promise<
  | { ok: true; moved: number; merged: number }
  | { error: 'list_not_found' | string }
> {
  if (ids.length === 0) return { ok: true, moved: 0, merged: 0 }
  const { supabase, user, authError } = await getSessionUser()
  // Use the shared NOT_SIGNED_IN constant so the three bulk actions report
  // the same string on auth failure — callers can branch on a single value.
  if (!user) return { error: authError ?? NOT_SIGNED_IN }

  // Verify the target list belongs to this user — RLS would block the
  // update otherwise, but a clean error is friendlier than a 23503 FK.
  const { data: list } = await supabase
    .from('next_to_test_lists')
    .select('id')
    .eq('id', listId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!list) return { error: 'list_not_found' }

  // 1. Fetch the selection's slots + the fields a merge can carry over.
  //    A failed read must not look like "nothing selected" / "no twins": the
  //    second would re-parent colliding rows straight into the unique index.
  const { data: rows, error: rowsError } = await supabase
    .from('next_to_test')
    .select('id, list_id, biomarker_id, lab_test_id, status, note, due_date')
    .in('id', ids)
    .eq('user_id', user.id)
  if (rowsError) {
    return {
      error: userErrorMessage(
        'bulkMoveEntries read',
        rowsError,
        'Could not move the entries. Please try again.'
      ),
    }
  }
  const selection = (rows ?? []) as MoveRow[]

  // 2. Fetch the target list's rows so collisions can be resolved into their
  //    existing twin.
  const { data: existing, error: existingError } = await supabase
    .from('next_to_test')
    .select('id, list_id, biomarker_id, lab_test_id, status, note, due_date')
    .eq('list_id', listId)
    .eq('user_id', user.id)
  if (existingError) {
    return {
      error: userErrorMessage(
        'bulkMoveEntries existing',
        existingError,
        'Could not move the entries. Please try again.'
      ),
    }
  }
  const targetRows = (existing ?? []) as MoveRow[]

  // 3. Partition: already-on-target is a no-op success, collisions merge into
  //    the target twin, the rest re-parents via UPDATE.
  const { movableIds, mergeSourceIds, mergePatches, alreadyThere } = planBulkMove(
    selection,
    targetRows,
    listId,
    opts
  )

  // The writes run in ONE transaction (apply_next_to_test_move): the
  // re-parent, the twin patches and the source deletes. A row that vanished
  // mid-move (deleted in another tab) or any other failure rolls back every
  // write, so a move never leaves rows half-merged.
  const { data: deleted, error: moveError } = await supabase.rpc('apply_next_to_test_move', {
    p_list_id: listId,
    p_move_ids: movableIds,
    p_patches: [...mergePatches].map(([id, patch]) => ({ id, ...patch })),
    p_delete_ids: mergeSourceIds,
  })
  if (moveError) {
    if (moveError.message === 'move_changed') return { error: MOVE_CHANGED }
    return {
      error: userErrorMessage(
        'bulkMoveEntries',
        moveError,
        'Could not move the entries. Please try again.'
      ),
    }
  }

  revalidatePath('/next-to-test')
  return {
    ok: true,
    moved: movableIds.length + alreadyThere + (deleted ?? 0),
    merged: deleted ?? 0,
  }
}

/**
 * Flip `status` (pending ↔ done) on every selected entry. No unique-index
 * concerns; a single UPDATE handles the whole selection.
 */
export async function bulkUpdateEntryStatus(
  ids: string[],
  status: NextToTestStatus
): Promise<BulkAuthErr | BulkNoOp | { ok: true; count: number } | Err> {
  if (ids.length === 0) return { ok: true, count: 0 }
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? NOT_SIGNED_IN }
  const { error, data } = await supabase
    .from('next_to_test')
    .update({ status })
    .in('id', ids)
    .eq('user_id', user.id)
    .select('id')
  if (error) {
    return {
      error: userErrorMessage(
        'bulkUpdateEntryStatus',
        error,
        'Could not update the entries. Please try again.'
      ),
    }
  }
  revalidatePath('/next-to-test')
  return { ok: true, count: (data ?? []).length }
}

/** Bulk delete the selection. RLS + explicit user_id filter scope it. */
export async function bulkDeleteEntries(
  ids: string[]
): Promise<BulkAuthErr | BulkNoOp | { ok: true; count: number } | Err> {
  if (ids.length === 0) return { ok: true, count: 0 }
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? NOT_SIGNED_IN }
  const { error, data } = await supabase
    .from('next_to_test')
    .delete()
    .in('id', ids)
    .eq('user_id', user.id)
    .select('id')
  if (error) {
    return {
      error: userErrorMessage(
        'bulkDeleteEntries',
        error,
        'Could not delete the entries. Please try again.'
      ),
    }
  }
  revalidatePath('/next-to-test')
  return { ok: true, count: (data ?? []).length }
}
