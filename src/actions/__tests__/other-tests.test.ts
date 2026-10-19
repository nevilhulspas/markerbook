import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUser, mockRevalidatePath } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

type DbError = { message: string } | null

const state = {
  updatePayload: null as Record<string, unknown> | null,
  updateEqId: null as string | null,
  previousValues: [] as unknown[],
  deletedTestIds: [] as string[],
  inserts: [] as unknown[][],
  updateError: null as DbError,
  deleteError: null as DbError,
  insertError: null as DbError,
  restoreError: null as DbError,
  snapshotError: null as DbError,
}

function reset() {
  state.updatePayload = null
  state.updateEqId = null
  state.previousValues = []
  state.deletedTestIds = []
  state.inserts = []
  state.updateError = null
  state.deleteError = null
  state.insertError = null
  state.restoreError = null
  state.snapshotError = null
}

function fromBuilder(table: string) {
  return {
    update(payload: Record<string, unknown>) {
      if (table === 'other_tests') state.updatePayload = payload
      return {
        eq: (_col: string, id: string) => {
          if (table === 'other_tests') state.updateEqId = id
          return Promise.resolve({ error: state.updateError })
        },
      }
    },
    select() {
      return {
        eq: () =>
          Promise.resolve({ data: state.previousValues, error: state.snapshotError }),
      }
    },
    delete() {
      return {
        eq: (_col: string, id: string) => {
          if (table === 'other_test_values') state.deletedTestIds.push(id)
          return Promise.resolve({ error: state.deleteError })
        },
      }
    },
    insert(rows: unknown) {
      if (table === 'other_test_values') {
        state.inserts.push(Array.isArray(rows) ? rows : [rows])
        // First insert is the new readings; any later insert is the rollback.
        const isRollback = state.inserts.length > 1
        return Promise.resolve({
          error: isRollback ? state.restoreError : state.insertError,
        })
      }
      return Promise.resolve({ error: state.insertError })
    },
  }
}

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn((t: string) => fromBuilder(t)),
    auth: { getUser: mockGetUser },
  })),
}))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: { storage: { from: vi.fn() } } }))

import { updateOtherTest } from '../other-tests'

const validExtraction = {
  test: {
    test_name: 'SIBO breath test',
    test_date: '2026-06-20',
    provider: 'Biolab',
    outcome: 'positive' as const,
    result_summary: 'Methane-positive',
    notes: 'recheck in 3 months',
  },
  values: [
    { label: 'Methane (CH4)', value: '12', unit: 'ppm', flag: 'high' },
    { label: 'Hydrogen (H2)', value: '3', unit: 'ppm', flag: null },
  ],
}

describe('updateOtherTest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reset()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('rejects when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const { error } = await updateOtherTest('test-1', validExtraction)
    expect(error).toBe('Not authenticated')
    expect(state.updatePayload).toBeNull()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('rejects invalid data before touching the database', async () => {
    const { error } = await updateOtherTest('test-1', {
      test: {
        test_name: '', // fails the min(1) guard
        test_date: '',
        provider: null,
        outcome: 'not_applicable',
        result_summary: null,
        notes: null,
      },
      values: [],
    })
    expect(error).toBe('Invalid test data')
    expect(state.updatePayload).toBeNull()
    expect(state.deletedTestIds).toHaveLength(0)
  })

  it('updates the parent, replaces readings, and revalidates', async () => {
    const { error } = await updateOtherTest('test-1', validExtraction)
    expect(error).toBeNull()

    // Parent row updated with the edited fields + a fresh updated_at.
    expect(state.updateEqId).toBe('test-1')
    expect(state.updatePayload).toMatchObject({
      test_name: 'SIBO breath test',
      test_date: '2026-06-20',
      provider: 'Biolab',
      outcome: 'positive',
      result_summary: 'Methane-positive',
      notes: 'recheck in 3 months',
    })
    expect(state.updatePayload?.updated_at).toEqual(expect.any(String))

    // Old readings cleared, new ones inserted with re-sequenced sort_order.
    expect(state.deletedTestIds).toEqual(['test-1'])
    expect(state.inserts).toHaveLength(1)
    expect(state.inserts[0]).toEqual([
      { test_id: 'test-1', label: 'Methane (CH4)', value: '12', unit: 'ppm', flag: 'high', sort_order: 0 },
      { test_id: 'test-1', label: 'Hydrogen (H2)', value: '3', unit: 'ppm', flag: null, sort_order: 1 },
    ])

    expect(mockRevalidatePath).toHaveBeenCalledWith('/other')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/other/test-1')
  })

  it('clears readings without inserting when none remain', async () => {
    const { error } = await updateOtherTest('test-1', {
      ...validExtraction,
      values: [],
    })
    expect(error).toBeNull()
    expect(state.deletedTestIds).toEqual(['test-1'])
    expect(state.inserts).toHaveLength(0)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/other/test-1')
  })

  it('restores the previous readings when the re-insert fails', async () => {
    state.previousValues = [
      { label: 'Old reading', value: '1', unit: 'ppm', flag: null, sort_order: 0 },
    ]
    state.insertError = { message: 'insert failed' }

    const { error } = await updateOtherTest('test-1', validExtraction)
    expect(error).toBe('insert failed')

    // First insert is the new rows; second is the snapshot rollback.
    expect(state.inserts).toHaveLength(2)
    expect(state.inserts[1]).toEqual([
      { test_id: 'test-1', label: 'Old reading', value: '1', unit: 'ppm', flag: null, sort_order: 0 },
    ])
    // A failed replace must not report success.
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('surfaces a recovery error when both insert and restore fail', async () => {
    state.previousValues = [
      { label: 'Old reading', value: '1', unit: 'ppm', flag: null, sort_order: 0 },
    ]
    state.insertError = { message: 'insert failed' }
    state.restoreError = { message: 'restore failed' }

    const { error } = await updateOtherTest('test-1', validExtraction)
    // Distinct, user-actionable message — not the generic insert error.
    expect(error).toContain('could not be restored')
    expect(state.inserts).toHaveLength(2)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('aborts before deleting when the readings snapshot fails', async () => {
    state.snapshotError = { message: 'snapshot failed' }
    const { error } = await updateOtherTest('test-1', validExtraction)
    expect(error).toBe('snapshot failed')
    // Must not touch the readings if we can't snapshot them first.
    expect(state.deletedTestIds).toHaveLength(0)
    expect(state.inserts).toHaveLength(0)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('aborts when the parent update fails', async () => {
    state.updateError = { message: 'update failed' }
    const { error } = await updateOtherTest('test-1', validExtraction)
    expect(error).toBe('update failed')
    expect(state.deletedTestIds).toHaveLength(0)
    expect(state.inserts).toHaveLength(0)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})
