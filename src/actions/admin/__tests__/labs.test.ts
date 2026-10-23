import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRequireAdmin, mockRevalidatePath } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

// Track query builder calls for assertions
let insertCalls: Array<{ table: string; data: unknown }> = []
let updateCalls: Array<{ table: string; data: unknown }> = []
let deleteCalls: Array<{ table: string }> = []
let eqCalls: Array<[string, unknown]> = []

// Controllable results keyed by intent. The lab_tests save flow needs its own
// result (the returned row carries the testId used for biomarker links).
let labsResult: { data: unknown; error: unknown } = { data: null, error: null }
let labTestSaveResult: { data: unknown; error: unknown } = {
  data: { id: 'test-1' },
  error: null,
}

function resetMocks() {
  insertCalls = []
  updateCalls = []
  deleteCalls = []
  eqCalls = []
  labsResult = { data: null, error: null }
  labTestSaveResult = { data: { id: 'test-1' }, error: null }
}

// A chainable builder that records calls and resolves (PromiseLike) to a
// controllable result. `select`/`single` pass through so the
// insert(...).select().single() and update(...).eq().select().single() chains
// both terminate on the same result object.
function createBuilder(
  table: string,
  result: () => { data: unknown; error: unknown }
) {
  const builder: Record<string, unknown> = {
    insert: (data: unknown) => {
      insertCalls.push({ table, data })
      return builder
    },
    update: (data: unknown) => {
      updateCalls.push({ table, data })
      return builder
    },
    delete: () => {
      deleteCalls.push({ table })
      return builder
    },
    select: () => builder,
    order: () => builder,
    eq: (col: string, val: unknown) => {
      eqCalls.push([col, val])
      return builder
    },
    single: () => builder,
    then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
      Promise.resolve(result()).then(resolve, reject),
  }
  return builder
}

vi.mock('server-only', () => ({}))

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'lab_tests') {
        return createBuilder(table, () => labTestSaveResult)
      }
      // labs and lab_test_biomarkers share the labsResult result.
      return createBuilder(table, () => labsResult)
    }),
  },
}))

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: mockRequireAdmin,
}))

import {
  adminCreateLab,
  adminUpdateLab,
  adminSetLabStatus,
  adminDeleteLab,
  adminSaveLabTest,
  adminDeleteLabTest,
  adminListLabTests,
} from '../labs'

const adminUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  app_metadata: { role: 'admin' },
}

describe('adminCreateLab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
  })

  it('throws when requireAdmin rejects', async () => {
    mockRequireAdmin.mockRejectedValue(
      new Error('Not authorized: admin role required')
    )

    await expect(adminCreateLab({ name: 'x' })).rejects.toThrow()
  })

  it('inserts with submitted_by and default approved status, returns data, revalidates', async () => {
    labsResult = { data: { id: 'lab-1', name: 'Acme Lab' }, error: null }

    const result = await adminCreateLab({ name: 'Acme Lab' })

    expect(insertCalls.length).toBe(1)
    expect(insertCalls[0].table).toBe('labs')
    const inserted = insertCalls[0].data as Record<string, unknown>
    expect(inserted.name).toBe('Acme Lab')
    expect(inserted.submitted_by).toBe('admin-1')
    expect(inserted.status).toBe('approved')
    expect(inserted.country).toBeNull()

    expect(result).toEqual({ data: { id: 'lab-1', name: 'Acme Lab' }, error: null })

    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/labs')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/labs')
  })

  it('honors an explicit status', async () => {
    labsResult = { data: { id: 'lab-1' }, error: null }

    await adminCreateLab({ name: 'Pending Lab', status: 'pending' })

    const inserted = insertCalls[0].data as Record<string, unknown>
    expect(inserted.status).toBe('pending')
  })

  it('returns the error and does not revalidate when insert fails', async () => {
    labsResult = { data: null, error: { message: 'Insert failed' } }

    const result = await adminCreateLab({ name: 'x' })

    expect(result).toEqual({ data: null, error: 'Insert failed' })
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('maps a unique-violation to a friendly "already exists" message', async () => {
    labsResult = { data: null, error: { code: '23505', message: 'duplicate key' } }

    const result = await adminCreateLab({ name: 'Dup Lab' })

    expect(result.data).toBeNull()
    expect(result.error).toMatch(/already exists/i)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})

describe('adminUpdateLab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
  })

  it('updates the patched fields with a fresh updated_at and revalidates', async () => {
    labsResult = { data: null, error: null }

    const result = await adminUpdateLab('lab-1', { name: 'Renamed', city: 'Amsterdam' })

    expect(updateCalls.length).toBe(1)
    const patch = updateCalls[0].data as Record<string, unknown>
    expect(patch.name).toBe('Renamed')
    expect(patch.city).toBe('Amsterdam')
    expect(patch.updated_at).toBeDefined()
    expect(eqCalls).toContainEqual(['id', 'lab-1'])
    expect(result).toEqual({ error: null })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/labs')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/labs')
  })

  it('returns error and skips revalidate when update fails', async () => {
    labsResult = { data: null, error: { message: 'Update failed' } }

    const result = await adminUpdateLab('lab-1', { name: 'x' })

    expect(result).toEqual({ error: 'Update failed' })
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('maps a unique-violation on rename to a friendly message', async () => {
    labsResult = { data: null, error: { code: '23505', message: 'duplicate key' } }

    const result = await adminUpdateLab('lab-1', { name: 'Existing Name' })

    expect(result.error).toMatch(/already uses that name or website/i)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})

describe('adminSetLabStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
  })

  it('approving a lab also approves the tests its import left pending', async () => {
    labsResult = { data: null, error: null }
    labTestSaveResult = { data: [{ id: 't1' }, { id: 't2' }], error: null }

    const result = await adminSetLabStatus('lab-1', 'approved')

    const testUpdates = updateCalls.filter((c) => c.table === 'lab_tests')
    expect(testUpdates).toHaveLength(2)
    for (const u of testUpdates) {
      expect(u.data).toMatchObject({ status: 'approved', reviewed_by: 'admin-1' })
    }
    expect(eqCalls).toContainEqual(['id', 't1'])
    expect(eqCalls).toContainEqual(['id', 't2'])
    expect(result).toEqual({ error: null })
  })

  it('rejecting a lab leaves its tests alone', async () => {
    labsResult = { data: null, error: null }

    await adminSetLabStatus('lab-1', 'rejected')

    expect(updateCalls.filter((c) => c.table === 'lab_tests')).toHaveLength(0)
  })

  it('sets status, reviewed_by, reviewed_at, review_notes and revalidates', async () => {
    labsResult = { data: null, error: null }
    labTestSaveResult = { data: [], error: null } // no pending tests

    const result = await adminSetLabStatus('lab-1', 'approved', 'Looks good')

    expect(updateCalls.length).toBe(1)
    const patch = updateCalls[0].data as Record<string, unknown>
    expect(patch.status).toBe('approved')
    expect(patch.reviewed_by).toBe('admin-1')
    expect(patch.reviewed_at).toBeDefined()
    expect(patch.review_notes).toBe('Looks good')
    expect(patch.updated_at).toBeDefined()
    expect(eqCalls).toContainEqual(['id', 'lab-1'])
    expect(result).toEqual({ error: null })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/labs')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/labs')
  })

  it('defaults review_notes to null when omitted', async () => {
    labsResult = { data: null, error: null }

    await adminSetLabStatus('lab-1', 'rejected')

    const patch = updateCalls[0].data as Record<string, unknown>
    expect(patch.review_notes).toBeNull()
  })
})

describe('adminDeleteLab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
  })

  it('deletes by id and revalidates', async () => {
    labsResult = { data: null, error: null }

    const result = await adminDeleteLab('lab-1')

    expect(deleteCalls).toContainEqual({ table: 'labs' })
    expect(eqCalls).toContainEqual(['id', 'lab-1'])
    expect(result).toEqual({ error: null })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/labs')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/labs')
  })
})

describe('adminSaveLabTest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
  })

  it('inserts a new test, then deletes and re-inserts biomarker links', async () => {
    labTestSaveResult = { data: { id: 'test-1' }, error: null }
    labsResult = { data: null, error: null }

    const result = await adminSaveLabTest({
      lab_id: 'lab-1',
      name: 'Lipid Panel',
      biomarkerIds: ['bio-1', 'bio-2'],
    })

    // The test row was inserted (not updated) into lab_tests.
    const testInsert = insertCalls.find((c) => c.table === 'lab_tests')
    expect(testInsert).toBeDefined()
    const row = testInsert!.data as Record<string, unknown>
    expect(row.lab_id).toBe('lab-1')
    expect(row.name).toBe('Lipid Panel')
    expect(row.submitted_by).toBe('admin-1')
    expect(row.status).toBe('approved')
    expect(updateCalls.find((c) => c.table === 'lab_tests')).toBeUndefined()

    // Existing biomarker links were deleted for the returned testId.
    expect(deleteCalls).toContainEqual({ table: 'lab_test_biomarkers' })
    expect(eqCalls).toContainEqual(['lab_test_id', 'test-1'])

    // New links were re-inserted as one payload of { lab_test_id, biomarker_id }.
    const linkInsert = insertCalls.find((c) => c.table === 'lab_test_biomarkers')
    expect(linkInsert).toBeDefined()
    expect(linkInsert!.data).toEqual([
      { lab_test_id: 'test-1', biomarker_id: 'bio-1' },
      { lab_test_id: 'test-1', biomarker_id: 'bio-2' },
    ])

    expect(result).toEqual({ data: { id: 'test-1' }, error: null })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/labs')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/labs')
  })

  it('updates an existing test when id is provided', async () => {
    labTestSaveResult = { data: { id: 'test-9' }, error: null }
    labsResult = { data: null, error: null }

    await adminSaveLabTest({
      id: 'test-9',
      lab_id: 'lab-1',
      name: 'Updated Panel',
      biomarkerIds: [],
    })

    const testUpdate = updateCalls.find((c) => c.table === 'lab_tests')
    expect(testUpdate).toBeDefined()
    expect(eqCalls).toContainEqual(['id', 'test-9'])
    expect(insertCalls.find((c) => c.table === 'lab_tests')).toBeUndefined()

    // With no biomarkerIds, links are still cleared but no insert happens.
    expect(deleteCalls).toContainEqual({ table: 'lab_test_biomarkers' })
    expect(insertCalls.find((c) => c.table === 'lab_test_biomarkers')).toBeUndefined()
  })

  it('returns an error and skips link mutations when the save fails', async () => {
    labTestSaveResult = { data: null, error: { message: 'Save failed' } }

    const result = await adminSaveLabTest({
      lab_id: 'lab-1',
      name: 'Lipid Panel',
      biomarkerIds: ['bio-1'],
    })

    expect(result).toEqual({ data: null, error: 'Save failed' })
    expect(deleteCalls.find((c) => c.table === 'lab_test_biomarkers')).toBeUndefined()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('throws when requireAdmin rejects', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Not authenticated'))

    await expect(
      adminSaveLabTest({ lab_id: 'lab-1', name: 'x', biomarkerIds: [] })
    ).rejects.toThrow()
  })
})

describe('adminDeleteLabTest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
  })

  it('deletes the test by id and revalidates', async () => {
    labTestSaveResult = { data: null, error: null }
    labsResult = { data: null, error: null }

    const result = await adminDeleteLabTest('test-1')

    expect(deleteCalls).toContainEqual({ table: 'lab_tests' })
    expect(eqCalls).toContainEqual(['id', 'test-1'])
    expect(result).toEqual({ error: null })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/labs')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/labs')
  })
})

describe('adminListLabTests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
  })

  it('throws when requireAdmin rejects', async () => {
    mockRequireAdmin.mockRejectedValue(
      new Error('Not authorized: admin role required')
    )

    await expect(adminListLabTests('lab-1')).rejects.toThrow()
  })

  it('queries lab_tests by lab_id with no status filter and flattens biomarkers', async () => {
    labTestSaveResult = {
      data: [
        {
          id: 'test-1',
          lab_id: 'lab-1',
          name: 'Lipid Panel',
          status: 'pending',
          lab_test_biomarkers: [
            { biomarkers: { id: 'bio-1', name: 'LDL', short_name: 'LDL' } },
            { biomarkers: null },
          ],
        },
      ],
      error: null,
    }

    const result = await adminListLabTests('lab-1')

    expect(eqCalls).toContainEqual(['lab_id', 'lab-1'])
    // No status filter applied (admins see all statuses).
    expect(eqCalls).not.toContainEqual(['status', 'approved'])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('test-1')
    expect(result[0].biomarkers).toEqual([
      { id: 'bio-1', name: 'LDL', short_name: 'LDL' },
    ])
  })

  it('returns an empty array when the query errors', async () => {
    labTestSaveResult = { data: null, error: { message: 'boom' } }

    const result = await adminListLabTests('lab-1')

    expect(result).toEqual([])
  })
})
