import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRequireAdmin, mockWriteAuditLog, mockRevalidatePath } =
  vi.hoisted(() => ({
    mockRequireAdmin: vi.fn(),
    mockWriteAuditLog: vi.fn(),
    mockRevalidatePath: vi.fn(),
  }))

let insertCalls: unknown[] = []
let deleteCalls: boolean[] = []
let selectCalls: string[] = []
let eqCalls: Array<[string, unknown]> = []
let orderCalls: Array<[string, Record<string, unknown>?]> = []
let queryResult: { data: unknown; error: unknown } = { data: null, error: null }

function resetQueryMocks() {
  insertCalls = []
  deleteCalls = []
  selectCalls = []
  eqCalls = []
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
    insert: (data: unknown) => {
      insertCalls.push(data)
      return builder
    },
    delete: () => {
      deleteCalls.push(true)
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

import { getUnitsForBiomarker, createUnit, deleteUnit } from '../units'

const adminUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  app_metadata: { role: 'admin' },
}

describe('getUnitsForBiomarker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
  })

  it('calls requireAdmin and queries biomarker_units', async () => {
    const mockUnits = [
      { id: 'u-1', biomarker_id: 'bio-1', unit: 'mg/dL', is_default: true, conversion_factor: 1 },
    ]
    queryResult = { data: mockUnits, error: null }

    const result = await getUnitsForBiomarker('bio-1')

    expect(mockRequireAdmin).toHaveBeenCalled()
    expect(eqCalls).toContainEqual(['biomarker_id', 'bio-1'])
    expect(result).toEqual({ data: mockUnits, error: null })
  })
})

describe('createUnit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
    mockWriteAuditLog.mockResolvedValue({ success: true })
  })

  it('calls requireAdmin, inserts with conversion_factor, and writes audit log', async () => {
    queryResult = { data: { id: 'u-1' }, error: null }

    const result = await createUnit({
      biomarker_id: '123e4567-e89b-12d3-a456-426614174000',
      unit: 'mmol/L',
      is_default: false,
      conversion_factor: 0.0555,
    })

    expect(mockRequireAdmin).toHaveBeenCalled()
    expect(insertCalls.length).toBe(1)
    const insertData = insertCalls[0] as Record<string, unknown>
    expect(insertData.conversion_factor).toBe(0.0555)
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'create',
        entityType: 'biomarker_unit',
        entityId: 'u-1',
      })
    )
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/biomarkers')
    expect(result).toEqual({ success: true, unitId: 'u-1' })
  })

  it('returns error on supabase failure', async () => {
    queryResult = { data: null, error: { message: 'Insert failed' } }

    const result = await createUnit({
      biomarker_id: '123e4567-e89b-12d3-a456-426614174000',
      unit: 'mmol/L',
      is_default: false,
      conversion_factor: 0.0555,
    })

    expect(result).toEqual({ success: false, error: 'Insert failed' })
  })
})

describe('deleteUnit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
    mockWriteAuditLog.mockResolvedValue({ success: true })
  })

  it('calls requireAdmin, deletes by id, and writes audit log with action delete', async () => {
    queryResult = { data: null, error: null }

    const result = await deleteUnit('u-1')

    expect(mockRequireAdmin).toHaveBeenCalled()
    expect(deleteCalls.length).toBe(1)
    expect(eqCalls).toContainEqual(['id', 'u-1'])
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'delete',
        entityType: 'biomarker_unit',
        entityId: 'u-1',
      })
    )
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/biomarkers')
    expect(result).toEqual({ success: true })
  })

  it('returns error on supabase failure', async () => {
    queryResult = { data: null, error: { message: 'Delete failed' } }

    const result = await deleteUnit('u-1')

    expect(result).toEqual({ success: false, error: 'Delete failed' })
  })
})
