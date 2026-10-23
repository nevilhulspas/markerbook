import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }))

// In-memory Supabase mock state shared across tests.
type Row = Record<string, unknown> & { id: string }
let lists: Row[] = []
let entries: Row[] = []
let insertError: { code?: string; message: string } | null = null
let updateError: { code?: string; message: string } | null = null
// Reads of next_to_test fail with this error when set.
let readError: { message: string } | null = null
// Updates match no rows when set — a row deleted between read and write.
let updatesMatchNothing = false
// Runs once just before the Nth read of next_to_test (1-based) — simulates
// another tab changing rows between the action's reads.
let beforeEntryRead: { n: number; fn: () => void } | null = null
let entryReads = 0
// Runs once just before the apply_next_to_test_move RPC — simulates another
// tab changing rows after the action planned the move.
let beforeRpc: (() => void) | null = null

function resetState() {
  lists = []
  entries = []
  insertError = null
  updateError = null
  readError = null
  updatesMatchNothing = false
  beforeEntryRead = null
  entryReads = 0
  beforeRpc = null
  mockGetUser.mockReset()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
}

// Minimal chainable builder that supports the queries the actions use.
function createBuilder(table: 'next_to_test_lists' | 'next_to_test') {
  const filters: Array<[string, unknown]> = []
  let head = false
  let countExact = false
  const collection = () => (table === 'next_to_test_lists' ? lists : entries)
  const matched = () =>
    collection().filter((r) => filters.every(([k, v]) => r[k] === v))

  const builder: Record<string, unknown> = {
    select(_cols?: string, opts?: { count?: 'exact'; head?: boolean }) {
      head = opts?.head === true
      countExact = opts?.count === 'exact'
      return builder
    },
    eq(col: string, val: unknown) {
      filters.push([col, val])
      return builder
    },
    order() {
      return builder
    },
    limit() {
      return builder
    },
    in(col: string, vals: unknown[]) {
      // For the simple cases the actions use, behave as: row[col] in vals
      const orig = matched
      const matchedIn = () => orig().filter((r) => vals.includes(r[col]))
      // Replace matched() locally by rebinding via closure — for then() below.
      ;(builder as unknown as { __matched?: () => Row[] }).__matched = matchedIn
      return builder
    },
    maybeSingle() {
      const fn =
        (builder as unknown as { __matched?: () => Row[] }).__matched ?? matched
      const ms = fn()
      return Promise.resolve({ data: ms[0] ?? null, error: null })
    },
    single() {
      const fn =
        (builder as unknown as { __matched?: () => Row[] }).__matched ?? matched
      const ms = fn()
      return Promise.resolve({
        data: ms[0] ?? null,
        error: ms[0] ? null : { message: 'not found' },
      })
    },
    insert(rows: Row | Row[]) {
      if (insertError) {
        const chain: Record<string, unknown> = {
          select: () => chain,
          single: () => Promise.resolve({ data: null, error: insertError }),
        }
        return chain
      }
      const list = Array.isArray(rows) ? rows : [rows]
      const inserted = list.map((r) => ({
        ...r,
        id: r.id ?? `id-${Math.random().toString(36).slice(2, 9)}`,
        created_at: new Date('2026-05-28T00:00:00Z').toISOString(),
        updated_at: new Date('2026-05-28T00:00:00Z').toISOString(),
      }))
      collection().push(...inserted)
      const chain: Record<string, unknown> = {
        select: () => chain,
        single: () => Promise.resolve({ data: inserted[0], error: null }),
      }
      return chain
    },
    update(patch: Partial<Row>) {
      if (updateError) {
        const chain: Record<string, unknown> = {
          eq: () => chain,
          in: () => chain,
          select: () => chain,
          single: () => Promise.resolve({ data: null, error: updateError }),
          then: (resolve: (v: unknown) => unknown) =>
            resolve({ data: null, error: updateError }),
        }
        return chain
      }
      // .in('id', ids) — IN-list filter for bulk operations.
      let inIds: Set<unknown> | null = null
      const matchedWithIn = (): Row[] =>
        updatesMatchNothing
          ? []
          : matched().filter((r) => (inIds === null ? true : inIds.has(r.id)))
      const applyUpdate = (): Row[] => {
        const ms = matchedWithIn()
        ms.forEach((r) => Object.assign(r, patch))
        return ms
      }
      const chain: Record<string, unknown> = {
        eq(col: string, val: unknown) {
          filters.push([col, val])
          return chain
        },
        in(_col: string, vals: unknown[]) {
          inIds = new Set(vals)
          return chain
        },
        select: () => chain,
        single: () => {
          const ms = applyUpdate()
          return Promise.resolve({
            data: ms[0] ?? null,
            error: ms[0] ? null : { message: 'not found' },
          })
        },
        // Terminal await for bulk update: returns { data: rows[], error: null }
        // so callers using `.update().in().eq().select('id')` get a row count.
        then(resolve: (v: unknown) => unknown) {
          const ms = applyUpdate()
          return resolve({ data: ms, error: null })
        },
      }
      return chain
    },
    delete() {
      let inIds: Set<unknown> | null = null
      const matchedWithIn = (): Row[] =>
        matched().filter((r) => (inIds === null ? true : inIds.has(r.id)))
      const applyDelete = (): Row[] => {
        const ms = matchedWithIn()
        ms.forEach((r) => {
          const idx = collection().indexOf(r)
          if (idx >= 0) collection().splice(idx, 1)
        })
        return ms
      }
      const chain: Record<string, unknown> = {
        eq(col: string, val: unknown) {
          filters.push([col, val])
          return chain
        },
        in(_col: string, vals: unknown[]) {
          inIds = new Set(vals)
          return chain
        },
        select: () => chain,
        then(resolve: (v: unknown) => unknown) {
          const ms = applyDelete()
          return resolve({ data: ms, error: null })
        },
      }
      return chain
    },
    then(resolve: (v: unknown) => unknown) {
      const fn =
        (builder as unknown as { __matched?: () => Row[] }).__matched ?? matched
      if (table === 'next_to_test') {
        entryReads++
        if (beforeEntryRead?.n === entryReads) beforeEntryRead.fn()
        if (readError) return resolve({ data: null, error: readError })
      }
      if (head && countExact) {
        return resolve({ data: null, error: null, count: fn().length })
      }
      return resolve({ data: fn(), error: null })
    },
  }
  return builder
}

// In-memory copy of public.apply_next_to_test_move: re-parent, patch twins,
// delete merge sources — all or nothing, scoped to the signed-in user.
type MoveArgs = {
  p_list_id: string
  p_move_ids: string[]
  p_patches: Array<{ id: string } & Record<string, unknown>>
  p_delete_ids: string[]
}
function applyMoveRpc(args: MoveArgs) {
  beforeRpc?.()
  beforeRpc = null
  const snapshot = entries.map((e) => ({ ...e }))
  const own = (id: string) =>
    updatesMatchNothing ? undefined : entries.find((e) => e.id === id && e.user_id === 'user-1')
  const fail = () => {
    entries = snapshot
    return { data: null, error: { message: 'move_changed' } }
  }
  for (const id of args.p_move_ids) {
    const row = own(id)
    if (!row) return fail()
    row.list_id = args.p_list_id
  }
  for (const { id, ...patch } of args.p_patches) {
    const row = own(id)
    if (!row) return fail()
    Object.assign(row, patch)
  }
  const before = entries.length
  entries = entries.filter((e) => !(args.p_delete_ids.includes(e.id) && e.user_id === 'user-1'))
  return { data: before - entries.length, error: null }
}

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (t: 'next_to_test_lists' | 'next_to_test') => createBuilder(t),
    rpc: async (fn: string, args: MoveArgs) => {
      if (fn !== 'apply_next_to_test_move') throw new Error(`unexpected rpc ${fn}`)
      return applyMoveRpc(args)
    },
  }),
}))

import { revalidatePath } from 'next/cache'
import {
  getNextToTestLists,
  createNextToTestList,
  renameNextToTestList,
  deleteNextToTestList,
  getDefaultListId,
  getNextToTestSummary,
} from '@/actions/next-to-test/lists'
import {
  addBiomarkerToList,
  addLabTestToList,
  updateEntry,
  deleteEntry,
  pinEntryToLab,
  unpinEntryToBiomarker,
  addCategoryToList,
} from '@/actions/next-to-test/entries'
import {
  bulkMoveEntries,
  bulkUpdateEntryStatus,
  bulkDeleteEntries,
} from '@/actions/next-to-test/bulk'

describe('next-to-test actions', () => {
  beforeEach(resetState)

  it('createNextToTestList inserts a new list for the current user', async () => {
    const r = await createNextToTestList('Annual')
    expect('list' in r ? r.list.name : null).toBe('Annual')
    expect(lists).toHaveLength(1)
    expect((lists[0] as unknown as { user_id: string }).user_id).toBe('user-1')
  })

  it('getDefaultListId lazy-creates "Up next" on first call', async () => {
    const id = await getDefaultListId()
    expect(typeof id).toBe('string')
    expect(lists).toHaveLength(1)
    expect((lists[0] as unknown as { name: string }).name).toBe('Up next')
    // second call reuses
    const id2 = await getDefaultListId()
    expect(id2).toBe(id)
    expect(lists).toHaveLength(1)
  })

  it('addBiomarkerToList inserts and respects XOR (lab_test_id stays null)', async () => {
    const listR = await createNextToTestList('A')
    if (!('list' in listR)) throw new Error('list creation failed')
    const r = await addBiomarkerToList({
      listId: listR.list.id,
      biomarkerId: 'bm-1',
    })
    expect('entry' in r).toBe(true)
    if ('entry' in r) {
      expect(r.entry.biomarker_id).toBe('bm-1')
      expect(r.entry.lab_test_id).toBeNull()
      expect(r.entry.status).toBe('pending')
    }
  })

  it('addBiomarkerToList maps unique-violation (code 23505) to {error:"duplicate"}', async () => {
    const listR = await createNextToTestList('A')
    if (!('list' in listR)) throw new Error('list creation failed')
    insertError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint',
    }
    const r = await addBiomarkerToList({
      listId: listR.list.id,
      biomarkerId: 'bm-1',
    })
    expect(r).toEqual({ error: 'duplicate' })
  })

  it('updateEntry({status:"done"}) flips status', async () => {
    const listR = await createNextToTestList('A')
    if (!('list' in listR)) throw new Error('list creation failed')
    const addR = await addLabTestToList({
      listId: listR.list.id,
      labTestId: 'lt-1',
    })
    if (!('entry' in addR)) throw new Error('add failed')
    const upd = await updateEntry({ id: addR.entry.id, status: 'done' })
    expect('entry' in upd ? upd.entry.status : null).toBe('done')
  })

  it('updateEntry move-to-list duplicate is mapped to {error:"duplicate"}', async () => {
    const listR = await createNextToTestList('A')
    if (!('list' in listR)) throw new Error('list creation failed')
    const addR = await addLabTestToList({
      listId: listR.list.id,
      labTestId: 'lt-1',
    })
    if (!('entry' in addR)) throw new Error('add failed')
    const otherR = await createNextToTestList('B')
    if (!('list' in otherR)) throw new Error('list creation failed')
    updateError = { code: '23505', message: 'duplicate key' }
    const upd = await updateEntry({ id: addR.entry.id, listId: otherR.list.id })
    expect(upd).toEqual({ error: 'duplicate' })
  })

  it("refuses to file an entry under a list the user does not own", async () => {
    expect(await addLabTestToList({ listId: 'someone-elses-list', labTestId: 'lt-1' })).toEqual({
      error: 'list_not_found',
    })
    expect(await addBiomarkerToList({ listId: 'someone-elses-list', biomarkerId: 'bm-1' })).toEqual({
      error: 'list_not_found',
    })
  })

  it('deleteEntry removes the row', async () => {
    const listR = await createNextToTestList('A')
    if (!('list' in listR)) throw new Error('list creation failed')
    const addR = await addBiomarkerToList({
      listId: listR.list.id,
      biomarkerId: 'bm-1',
    })
    if (!('entry' in addR)) throw new Error('add failed')
    const before = entries.length
    await deleteEntry(addR.entry.id)
    expect(entries.length).toBe(before - 1)
  })

  it('renameNextToTestList updates name', async () => {
    const listR = await createNextToTestList('A')
    if (!('list' in listR)) throw new Error('list creation failed')
    const r = await renameNextToTestList(listR.list.id, 'B')
    expect(r.error).toBeNull()
    expect((lists[0] as unknown as { name: string }).name).toBe('B')
  })

  it('deleteNextToTestList removes the list', async () => {
    const listR = await createNextToTestList('A')
    if (!('list' in listR)) throw new Error('list creation failed')
    await deleteNextToTestList(listR.list.id)
    expect(lists).toHaveLength(0)
  })

  it('getNextToTestSummary returns pending count', async () => {
    const listR = await createNextToTestList('A')
    if (!('list' in listR)) throw new Error('list creation failed')
    await addBiomarkerToList({
      listId: listR.list.id,
      biomarkerId: 'bm-1',
    })
    await addBiomarkerToList({
      listId: listR.list.id,
      biomarkerId: 'bm-2',
    })
    const sum = await getNextToTestSummary()
    expect(sum.pendingCount).toBe(2)
  })

  it('all actions reject when not signed in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    await expect(getNextToTestLists()).resolves.toEqual([])
    await expect(createNextToTestList('X')).resolves.toEqual({
      error: 'You must be signed in.',
    })
  })

  it('getNextToTestLists returns rows for the current user', async () => {
    await createNextToTestList('A')
    const out = await getNextToTestLists()
    expect(out).toHaveLength(1)
  })

  it('pinEntryToLab converts a biomarker entry into a lab_test entry', async () => {
    const listR = await createNextToTestList('A')
    if (!('list' in listR)) throw new Error('list creation failed')
    const addR = await addBiomarkerToList({
      listId: listR.list.id,
      biomarkerId: 'bm-tsh',
    })
    if (!('entry' in addR)) throw new Error('add failed')
    const r = await pinEntryToLab(addR.entry.id, 'lt-tsh-lina')
    expect(r).toEqual({ ok: true })
    const after = entries.find((e) => e.id === addR.entry.id) as
      | (Row & { biomarker_id: string | null; lab_test_id: string | null })
      | undefined
    expect(after?.biomarker_id).toBeNull()
    expect(after?.lab_test_id).toBe('lt-tsh-lina')
  })

  it('unpinEntryToBiomarker converts a lab_test entry back to lab-agnostic', async () => {
    const listR = await createNextToTestList('A')
    if (!('list' in listR)) throw new Error('list creation failed')
    const addR = await addLabTestToList({
      listId: listR.list.id,
      labTestId: 'lt-vitd-lina',
    })
    if (!('entry' in addR)) throw new Error('add failed')
    const r = await unpinEntryToBiomarker(addR.entry.id, 'bm-vitd')
    expect(r).toEqual({ ok: true })
    const after = entries.find((e) => e.id === addR.entry.id) as
      | (Row & { biomarker_id: string | null; lab_test_id: string | null })
      | undefined
    expect(after?.biomarker_id).toBe('bm-vitd')
    expect(after?.lab_test_id).toBeNull()
  })

  it('pinEntryToLab refuses unauthenticated callers', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const r = await pinEntryToLab('e-1', 'lt-1')
    expect('error' in r ? r.error : null).toBe('unauthorized')
  })

  it('addCategoryToList stores a typed non-blood entry with custom name', async () => {
    const listR = await createNextToTestList('A')
    if (!('list' in listR)) throw new Error('list creation failed')
    const r = await addCategoryToList({
      listId: listR.list.id,
      testType: 'dexa',
      customName: '  DEXA at HumanFitness  ',
    })
    expect('entry' in r).toBe(true)
    if ('entry' in r) {
      expect(r.entry.test_type).toBe('dexa')
      expect(r.entry.custom_name).toBe('DEXA at HumanFitness')
      expect(r.entry.biomarker_id).toBeNull()
      expect(r.entry.lab_test_id).toBeNull()
    }
  })

  it('addCategoryToList stores a typed non-blood entry without custom name', async () => {
    const listR = await createNextToTestList('A')
    if (!('list' in listR)) throw new Error('list creation failed')
    const r = await addCategoryToList({
      listId: listR.list.id,
      testType: 'microbiome',
    })
    expect('entry' in r).toBe(true)
    if ('entry' in r) {
      expect(r.entry.test_type).toBe('microbiome')
      expect(r.entry.custom_name).toBeNull()
    }
  })

  it("addCategoryToList rejects 'other' without a custom name", async () => {
    const listR = await createNextToTestList('A')
    if (!('list' in listR)) throw new Error('list creation failed')
    const r = await addCategoryToList({
      listId: listR.list.id,
      testType: 'other',
      customName: '   ',
    })
    expect('error' in r).toBe(true)
    if ('error' in r) {
      expect(r.error).toMatch(/required/i)
    }
  })

  // -------------------------------------------------------------------
  // Bulk operations
  // -------------------------------------------------------------------

  it('bulkUpdateEntryStatus flips status on every selected entry', async () => {
    const listR = await createNextToTestList('A')
    if (!('list' in listR)) throw new Error('list creation failed')
    const a = await addBiomarkerToList({
      listId: listR.list.id,
      biomarkerId: 'bm-tsh',
    })
    const b = await addBiomarkerToList({
      listId: listR.list.id,
      biomarkerId: 'bm-vitd',
    })
    if (!('entry' in a) || !('entry' in b)) throw new Error('add failed')
    const r = await bulkUpdateEntryStatus([a.entry.id, b.entry.id], 'done')
    expect('ok' in r ? r.ok : false).toBe(true)
    const aAfter = entries.find((e) => e.id === a.entry.id) as
      | (Row & { status: string })
      | undefined
    const bAfter = entries.find((e) => e.id === b.entry.id) as
      | (Row & { status: string })
      | undefined
    expect(aAfter?.status).toBe('done')
    expect(bAfter?.status).toBe('done')
  })

  it('bulkDeleteEntries removes the selection', async () => {
    const listR = await createNextToTestList('A')
    if (!('list' in listR)) throw new Error('list creation failed')
    const a = await addBiomarkerToList({
      listId: listR.list.id,
      biomarkerId: 'bm-tsh',
    })
    const b = await addBiomarkerToList({
      listId: listR.list.id,
      biomarkerId: 'bm-vitd',
    })
    const c = await addBiomarkerToList({
      listId: listR.list.id,
      biomarkerId: 'bm-iron',
    })
    if (!('entry' in a) || !('entry' in b) || !('entry' in c))
      throw new Error('add failed')
    const r = await bulkDeleteEntries([a.entry.id, c.entry.id])
    expect('ok' in r ? r.ok : false).toBe(true)
    expect(entries.find((e) => e.id === a.entry.id)).toBeUndefined()
    expect(entries.find((e) => e.id === c.entry.id)).toBeUndefined()
    // The unselected entry survives the bulk delete.
    expect(entries.find((e) => e.id === b.entry.id)).toBeDefined()
  })

  it('bulkMoveEntries re-parents non-conflicting rows and merges collisions into the target twin', async () => {
    const srcR = await createNextToTestList('Source')
    const dstR = await createNextToTestList('Dest')
    if (!('list' in srcR) || !('list' in dstR))
      throw new Error('list creation failed')
    // Two rows in Source, one of which the user already has on Dest (done).
    const conflict = await addBiomarkerToList({
      listId: srcR.list.id,
      biomarkerId: 'bm-tsh',
    })
    const fresh = await addBiomarkerToList({
      listId: srcR.list.id,
      biomarkerId: 'bm-vitd',
    })
    const twinR = await addBiomarkerToList({
      listId: dstR.list.id,
      biomarkerId: 'bm-tsh',
    })
    if (!('entry' in conflict) || !('entry' in fresh) || !('entry' in twinR))
      throw new Error('add failed')
    // The Dest twin was completed earlier; the Source copy still needs
    // testing and carries a note the twin lacks.
    await updateEntry({ id: twinR.entry.id, status: 'done' })
    await updateEntry({ id: conflict.entry.id, note: 'retest after protocol' })

    const r = await bulkMoveEntries(
      [conflict.entry.id, fresh.entry.id],
      dstR.list.id
    )
    expect('ok' in r ? r.ok : false).toBe(true)
    if ('ok' in r) {
      expect(r.moved).toBe(2)
      expect(r.merged).toBe(1)
    }
    // The fresh row re-parents onto Dest.
    const freshAfter = entries.find((e) => e.id === fresh.entry.id) as
      | (Row & { list_id: string })
      | undefined
    expect(freshAfter?.list_id).toBe(dstR.list.id)
    // The colliding row merged: source deleted, twin revived to pending with
    // the source's note backfilled.
    expect(entries.find((e) => e.id === conflict.entry.id)).toBeUndefined()
    const twinAfter = entries.find((e) => e.id === twinR.entry.id) as
      | (Row & { status: string; note: string | null })
      | undefined
    expect(twinAfter?.status).toBe('pending')
    expect(twinAfter?.note).toBe('retest after protocol')
  })

  it('bulkMoveEntries sourceWins overwrites the twin note/due with the source values', async () => {
    const srcR = await createNextToTestList('Source')
    const dstR = await createNextToTestList('Dest')
    if (!('list' in srcR) || !('list' in dstR))
      throw new Error('list creation failed')
    const source = await addBiomarkerToList({
      listId: srcR.list.id,
      biomarkerId: 'bm-tsh',
    })
    const twinR = await addBiomarkerToList({
      listId: dstR.list.id,
      biomarkerId: 'bm-tsh',
    })
    if (!('entry' in source) || !('entry' in twinR)) throw new Error('add failed')
    // Both rows carry a note: the edit popover just saved the user's fresh
    // note onto the source, the twin still holds a stale one.
    await updateEntry({ id: twinR.entry.id, note: 'stale twin note' })
    await updateEntry({ id: source.entry.id, note: 'urgent retest' })

    const r = await bulkMoveEntries([source.entry.id], dstR.list.id, { sourceWins: true })
    expect('ok' in r ? r.ok : false).toBe(true)
    if ('ok' in r) expect(r.merged).toBe(1)
    const twinAfter = entries.find((e) => e.id === twinR.entry.id) as
      | (Row & { note: string | null })
      | undefined
    expect(twinAfter?.note).toBe('urgent retest')
  })

  it('bulkMoveEntries sourceWins propagates an explicit clear (null) onto the twin', async () => {
    const srcR = await createNextToTestList('Source')
    const dstR = await createNextToTestList('Dest')
    if (!('list' in srcR) || !('list' in dstR))
      throw new Error('list creation failed')
    const source = await addBiomarkerToList({
      listId: srcR.list.id,
      biomarkerId: 'bm-tsh',
    })
    const twinR = await addBiomarkerToList({
      listId: dstR.list.id,
      biomarkerId: 'bm-tsh',
    })
    if (!('entry' in source) || !('entry' in twinR)) throw new Error('add failed')
    // The user cleared the note in the popover (saved as null on the source);
    // the twin still holds a stale one — the clear must win on merge.
    await updateEntry({ id: twinR.entry.id, note: 'stale twin note' })
    await updateEntry({ id: source.entry.id, note: null })

    const r = await bulkMoveEntries([source.entry.id], dstR.list.id, { sourceWins: true })
    expect('ok' in r ? r.ok : false).toBe(true)
    const twinAfter = entries.find((e) => e.id === twinR.entry.id) as
      | (Row & { note: string | null })
      | undefined
    expect(twinAfter?.note).toBeNull()
  })

  it('bulkMoveEntries merges two selected rows that share a biomarker when the target has none', async () => {
    const aR = await createNextToTestList('A')
    const bR = await createNextToTestList('B')
    const dstR = await createNextToTestList('Dest')
    if (!('list' in aR) || !('list' in bR) || !('list' in dstR))
      throw new Error('list creation failed')
    const first = await addBiomarkerToList({ listId: aR.list.id, biomarkerId: 'bm-tsh' })
    const second = await addBiomarkerToList({ listId: bR.list.id, biomarkerId: 'bm-tsh' })
    if (!('entry' in first) || !('entry' in second)) throw new Error('add failed')
    await updateEntry({ id: second.entry.id, note: 'from list B' })

    const r = await bulkMoveEntries([first.entry.id, second.entry.id], dstR.list.id)

    expect(r).toEqual({ ok: true, moved: 2, merged: 1 })
    // One TSH row on Dest — the first, carrying the second's note.
    const onDest = entries.filter((e) => e.list_id === dstR.list.id)
    expect(onDest.map((e) => e.id)).toEqual([first.entry.id])
    expect(onDest[0].note).toBe('from list B')
    expect(entries.find((e) => e.id === second.entry.id)).toBeUndefined()
  })

  it('bulkMoveEntries returns a read error instead of treating it as an empty selection', async () => {
    const srcR = await createNextToTestList('Source')
    const dstR = await createNextToTestList('Dest')
    if (!('list' in srcR) || !('list' in dstR)) throw new Error('list creation failed')
    const e = await addBiomarkerToList({ listId: srcR.list.id, biomarkerId: 'bm-tsh' })
    if (!('entry' in e)) throw new Error('add failed')
    readError = { message: 'connection reset' }

    const r = await bulkMoveEntries([e.entry.id], dstR.list.id)

    expect(r).toEqual({ error: 'Could not move the entries. Please try again.' })
    expect(entries.find((x) => x.id === e.entry.id)?.list_id).toBe(srcR.list.id)
  })

  it('bulkMoveEntries rolls back the whole move when the re-parent matched fewer rows', async () => {
    const aR = await createNextToTestList('A')
    const bR = await createNextToTestList('B')
    const dstR = await createNextToTestList('Dest')
    if (!('list' in aR) || !('list' in bR) || !('list' in dstR))
      throw new Error('list creation failed')
    const first = await addBiomarkerToList({ listId: aR.list.id, biomarkerId: 'bm-tsh' })
    const second = await addBiomarkerToList({ listId: bR.list.id, biomarkerId: 'bm-tsh' })
    if (!('entry' in first) || !('entry' in second)) throw new Error('add failed')
    updatesMatchNothing = true
    vi.mocked(revalidatePath).mockClear()

    const r = await bulkMoveEntries([first.entry.id, second.entry.id], dstR.list.id)

    expect(r).toEqual({ error: 'Some entries changed while moving. Refresh and try again.' })
    // Nothing committed: both rows stay where they were.
    expect(entries.find((e) => e.id === first.entry.id)?.list_id).toBe(aR.list.id)
    expect(entries.find((e) => e.id === second.entry.id)?.list_id).toBe(bR.list.id)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('bulkMoveEntries keeps the source when its twin vanished, even with nothing to merge', async () => {
    const srcR = await createNextToTestList('Source')
    const dstR = await createNextToTestList('Dest')
    if (!('list' in srcR) || !('list' in dstR)) throw new Error('list creation failed')
    const source = await addBiomarkerToList({ listId: srcR.list.id, biomarkerId: 'bm-tsh' })
    const fresh = await addBiomarkerToList({ listId: srcR.list.id, biomarkerId: 'bm-vitd' })
    const twin = await addBiomarkerToList({ listId: dstR.list.id, biomarkerId: 'bm-tsh' })
    if (!('entry' in source) || !('entry' in fresh) || !('entry' in twin))
      throw new Error('add failed')
    // Both pending, no note/due: the merge patch is empty. The twin is deleted
    // in another tab after the action planned the move.
    beforeRpc = () => {
      entries = entries.filter((e) => e.id !== twin.entry.id)
    }

    const r = await bulkMoveEntries([source.entry.id, fresh.entry.id], dstR.list.id)

    expect(r).toEqual({ error: 'Some entries changed while moving. Refresh and try again.' })
    expect(entries.find((e) => e.id === source.entry.id)).toBeDefined()
    // The re-parent of the fresh row rolled back with the rest of the move.
    expect(entries.find((e) => e.id === fresh.entry.id)?.list_id).toBe(srcR.list.id)
  })

  it('bulkMoveEntries refuses to move into a list the user does not own', async () => {
    const r = await bulkMoveEntries(['e-1'], 'someone-elses-list-uuid')
    expect('error' in r ? r.error : null).toBe('list_not_found')
  })

  it('bulk actions reject unauthenticated callers', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const m = await bulkMoveEntries(['e-1'], 'l-1')
    const u = await bulkUpdateEntryStatus(['e-1'], 'done')
    const d = await bulkDeleteEntries(['e-1'])
    // All three bulk actions share the same NOT_SIGNED_IN error string so
    // callers can branch on a single value.
    expect('error' in m ? m.error : null).toBe('You must be signed in.')
    expect('error' in u ? u.error : null).toBe('You must be signed in.')
    expect('error' in d ? d.error : null).toBe('You must be signed in.')
  })
})
