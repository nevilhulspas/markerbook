import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRequireAdmin, mockWriteAuditLog, mockRevalidatePath } =
  vi.hoisted(() => ({
    mockRequireAdmin: vi.fn(),
    mockWriteAuditLog: vi.fn(),
    mockRevalidatePath: vi.fn(),
  }))

let insertCalls: unknown[] = []
let updateCalls: unknown[] = []
let selectCalls: string[] = []
let eqCalls: Array<[string, unknown]> = []
let isCalls: Array<[string, unknown]> = []
let ilikeCalls: Array<[string, string]> = []
let orderCalls: Array<[string, Record<string, unknown>?]> = []
let queryResult: { data: unknown; error: unknown } = { data: null, error: null }

function resetQueryMocks() {
  insertCalls = []
  updateCalls = []
  selectCalls = []
  eqCalls = []
  isCalls = []
  ilikeCalls = []
  orderCalls = []
  queryResult = { data: null, error: null }
}

function createQueryBuilder() {
  const builder: Record<string, unknown> = {
    select: (s: string) => {
      selectCalls.push(s)
      return builder
    },
    order: (col: string, opts?: Record<string, unknown>) => {
      orderCalls.push([col, opts])
      return builder
    },
    eq: (col: string, val: unknown) => {
      eqCalls.push([col, val])
      return builder
    },
    is: (col: string, val: unknown) => {
      isCalls.push([col, val])
      return builder
    },
    ilike: (col: string, val: string) => {
      ilikeCalls.push([col, val])
      return builder
    },
    insert: (data: unknown) => {
      insertCalls.push(data)
      return builder
    },
    update: (data: unknown) => {
      updateCalls.push(data)
      return builder
    },
    single: () => builder,
    then: (
      resolve: (val: unknown) => void,
      reject?: (err: unknown) => void
    ) => {
      return Promise.resolve(queryResult).then(resolve, reject)
    },
  }
  return builder
}

vi.mock('server-only', () => ({}))

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => createQueryBuilder()),
  },
}))

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: mockRequireAdmin,
}))

vi.mock('@/lib/audit/write-audit-log', () => ({
  writeAuditLog: mockWriteAuditLog,
}))

import {
  getAdminBiomarkers,
  createBiomarker,
  updateBiomarker,
  archiveBiomarker,
  restoreBiomarker,
} from '../biomarkers'

const adminUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  app_metadata: { role: 'admin' },
}

describe('getAdminBiomarkers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
  })

  it('calls requireAdmin before querying', async () => {
    queryResult = { data: [], error: null }

    await getAdminBiomarkers({})

    expect(mockRequireAdmin).toHaveBeenCalled()
  })

  it('filters by archived_at null when showArchived is false', async () => {
    queryResult = { data: [], error: null }

    await getAdminBiomarkers({ showArchived: false })

    expect(isCalls).toContainEqual(['archived_at', null])
  })

  it('does not filter archived when showArchived is true', async () => {
    queryResult = { data: [], error: null }

    await getAdminBiomarkers({ showArchived: true })

    const archivedFilter = isCalls.find(([col]) => col === 'archived_at')
    expect(archivedFilter).toBeUndefined()
  })

  it('filters by search term using ilike', async () => {
    queryResult = { data: [], error: null }

    await getAdminBiomarkers({ search: 'glucose' })

    expect(ilikeCalls).toContainEqual(['name', '%glucose%'])
  })

  it('filters by category', async () => {
    queryResult = { data: [], error: null }

    await getAdminBiomarkers({ category: 'Lipids' })

    expect(eqCalls).toContainEqual(['category', 'Lipids'])
  })
})

describe('createBiomarker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
    mockWriteAuditLog.mockResolvedValue({ success: true })
  })

  it('calls requireAdmin, inserts, writes audit log, and revalidates', async () => {
    queryResult = { data: { id: 'bio-1' }, error: null }

    const result = await createBiomarker({
      name: 'Glucose',
      category: 'Metabolic',
      unit: 'mg/dL',
    })

    expect(mockRequireAdmin).toHaveBeenCalled()
    expect(insertCalls.length).toBe(1)
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'create',
        entityType: 'biomarker',
        entityId: 'bio-1',
      })
    )
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/biomarkers')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/biomarkers')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/grid')
    expect(result).toEqual({ success: true, biomarkerId: 'bio-1' })
  })

  it('returns error on supabase failure', async () => {
    queryResult = { data: null, error: { message: 'Insert failed' } }

    const result = await createBiomarker({
      name: 'Glucose',
      category: 'Metabolic',
      unit: 'mg/dL',
    })

    expect(result).toEqual({ success: false, error: 'Insert failed' })
  })

  it('returns error on invalid input (empty name)', async () => {
    const result = await createBiomarker({
      name: '',
      category: 'Metabolic',
      unit: 'mg/dL',
    })

    expect(result).toEqual(
      expect.objectContaining({ success: false })
    )
  })
})

describe('updateBiomarker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
    mockWriteAuditLog.mockResolvedValue({ success: true })
  })

  it('calls requireAdmin, updates with id, and writes audit log', async () => {
    queryResult = { data: null, error: null }

    const result = await updateBiomarker('bio-1', { name: 'Updated Glucose' })

    expect(mockRequireAdmin).toHaveBeenCalled()
    expect(updateCalls.length).toBe(1)
    expect(eqCalls).toContainEqual(['id', 'bio-1'])
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'update',
        entityType: 'biomarker',
        entityId: 'bio-1',
      })
    )
    expect(result).toEqual({ success: true })
  })
})

describe('archiveBiomarker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
    mockWriteAuditLog.mockResolvedValue({ success: true })
  })

  it('sets archived_at and writes audit log with action archive', async () => {
    queryResult = { data: null, error: null }

    const result = await archiveBiomarker('bio-1')

    expect(mockRequireAdmin).toHaveBeenCalled()
    expect(updateCalls.length).toBe(1)
    const updateData = updateCalls[0] as Record<string, unknown>
    expect(updateData.archived_at).toBeDefined()
    expect(eqCalls).toContainEqual(['id', 'bio-1'])
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'archive',
        entityType: 'biomarker',
        entityId: 'bio-1',
      })
    )
    expect(result).toEqual({ success: true })
  })
})

describe('restoreBiomarker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
    mockWriteAuditLog.mockResolvedValue({ success: true })
  })

  it('sets archived_at to null and writes audit log', async () => {
    queryResult = { data: null, error: null }

    const result = await restoreBiomarker('bio-1')

    expect(mockRequireAdmin).toHaveBeenCalled()
    expect(updateCalls.length).toBe(1)
    const updateData = updateCalls[0] as Record<string, unknown>
    expect(updateData.archived_at).toBeNull()
    expect(eqCalls).toContainEqual(['id', 'bio-1'])
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'biomarker',
        entityId: 'bio-1',
        changes: { restored: true },
      })
    )
    expect(result).toEqual({ success: true })
  })
})
