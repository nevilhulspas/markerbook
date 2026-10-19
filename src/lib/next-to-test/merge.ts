// Pure planning step of bulkMoveEntries: decides which selected entries
// re-parent, which merge into an existing twin on the target list, and what
// each twin absorbs. The action applies the plan in one transaction through
// the apply_next_to_test_move RPC.

import type { NextToTestStatus } from '@/lib/database.types'

export type MoveRow = {
  id: string
  list_id: string
  biomarker_id: string | null
  lab_test_id: string | null
  status: NextToTestStatus
  note: string | null
  due_date: string | null
}

export type MergePatch = Partial<Pick<MoveRow, 'status' | 'note' | 'due_date'>>

export interface BulkMovePlan {
  movableIds: string[]
  mergeSourceIds: string[]
  mergePatches: Map<string, MergePatch>
  alreadyThere: number
}

export function planBulkMove(
  selection: MoveRow[],
  targetRows: MoveRow[],
  listId: string,
  opts?: { sourceWins?: boolean }
): BulkMovePlan {
  const targetByBiomarker = new Map(
    targetRows.filter((e) => e.biomarker_id).map((e) => [e.biomarker_id as string, e])
  )
  const targetByLabTest = new Map(
    targetRows.filter((e) => e.lab_test_id).map((e) => [e.lab_test_id as string, e])
  )

  // Partition: already-on-target is a no-op success, collisions merge into
  // the target twin, the rest re-parents via UPDATE.
  const movableIds: string[] = []
  const mergeSourceIds: string[] = []
  const mergePatches = new Map<string, MergePatch>()
  let alreadyThere = 0
  for (const r of selection) {
    if (r.list_id === listId) {
      alreadyThere++
      continue
    }
    const twin =
      (r.biomarker_id ? targetByBiomarker.get(r.biomarker_id) : undefined) ??
      (r.lab_test_id ? targetByLabTest.get(r.lab_test_id) : undefined)
    if (!twin) {
      movableIds.push(r.id)
      // Once moved, this row holds the slot on the target list: a later
      // selected row with the same biomarker / lab test must merge into it,
      // or both re-parent and the second trips the unique index.
      const moved = { ...r, list_id: listId }
      if (r.biomarker_id) targetByBiomarker.set(r.biomarker_id, moved)
      if (r.lab_test_id) targetByLabTest.set(r.lab_test_id, moved)
      continue
    }
    // Merge: pending wins over done (moving an entry usually means it still
    // needs testing); note/due backfill empty fields on the twin — or, with
    // sourceWins, mirror the source outright (fresh user edits, including an
    // explicit clear to null, must not lose to the twin's stale values).
    mergeSourceIds.push(r.id)
    const patch = mergePatches.get(twin.id) ?? {}
    if (r.status === 'pending' && twin.status === 'done') patch.status = 'pending'
    if (opts?.sourceWins) {
      if (!('note' in patch) && r.note !== twin.note) patch.note = r.note
      if (!('due_date' in patch) && r.due_date !== twin.due_date) patch.due_date = r.due_date
    } else {
      if (r.note && !twin.note && !patch.note) patch.note = r.note
      if (r.due_date && !twin.due_date && !patch.due_date) patch.due_date = r.due_date
    }
    mergePatches.set(twin.id, patch)
  }

  return { movableIds, mergeSourceIds, mergePatches, alreadyThere }
}
