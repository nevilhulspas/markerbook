import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRequireAdmin, mockWriteAuditLog, mockRevalidatePath } =
  vi.hoisted(() => ({
    mockRequireAdmin: vi.fn(),
    mockWriteAuditLog: vi.fn(),
    mockRevalidatePath: vi.fn(),
  }))

let insertCalls: unknown[] = []
let updateCalls: unknown[] = []
let deleteCalls: boolean[] = []
let selectCalls: string[] = []
let eqCalls: Array<[string, unknown]> = []
let orderCalls: Array<[string, Record<string, unknown>?]> = []
let upsertCalls: unknown[] = []
let isCalls: Array<[string, unknown]> = []
let queryResult: { data: unknown; error: unknown } = { data: null, error: null }
let biomarkerQueryResult: { data: unknown; error: unknown } = { data: null, error: null }

function resetQueryMocks() {
  insertCalls = []
  updateCalls = []
  deleteCalls = []
  selectCalls = []
  eqCalls = []
  orderCalls = []
  upsertCalls = []
  isCalls = []
  queryResult = { data: null, error: null }
  biomarkerQueryResult = { data: null, error: null }
}

function createQueryBuilder(resolveWith?: { data: unknown; error: unknown }) {
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
    insert: (data: unknown) => {
      insertCalls.push(data)
      return builder
    },
    update: (data: unknown) => {
      updateCalls.push(data)
      return builder
    },
    upsert: (data: unknown, opts?: unknown) => {
      upsertCalls.push({ data, opts })
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
      const result = resolveWith ?? queryResult
      return Promise.resolve(result).then(resolve, reject)
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
    from: vi.fn((table: string) => {
      if (table === 'biomarkers') {
        return createQueryBuilder(biomarkerQueryResult)
      }
      return createQueryBuilder()
    }),
  },
}))

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: mockRequireAdmin,
}))

vi.mock('@/lib/audit/write-audit-log', () => ({
  writeAuditLog: mockWriteAuditLog,
}))

import {
  getRangesForBiomarker,
  createRange,
  updateRange,
  deleteRange,
  bulkImportRanges,
  exportRangesCsv,
} from '../ranges'

const adminUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  app_metadata: { role: 'admin' },
}

describe('getRangesForBiomarker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
  })

  it('calls requireAdmin and queries reference_ranges', async () => {
    const mockRanges = [
      { id: 'r-1', biomarker_id: 'bio-1', unit: 'mg/dL', sex: 'general' },
    ]
    queryResult = { data: mockRanges, error: null }

    const result = await getRangesForBiomarker('bio-1')

    expect(mockRequireAdmin).toHaveBeenCalled()
    expect(eqCalls).toContainEqual(['biomarker_id', 'bio-1'])
    expect(result).toEqual({ data: mockRanges, error: null })
  })
})

describe('createRange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
    mockWriteAuditLog.mockResolvedValue({ success: true })
  })

  it('calls requireAdmin, inserts, and writes audit log', async () => {
    queryResult = { data: { id: 'r-1' }, error: null }

    const result = await createRange({
      biomarker_id: '123e4567-e89b-12d3-a456-426614174000',
      unit: 'mg/dL',
      sex: 'general',
      range_low: 70,
      range_high: 99,
      source: 'Lab Corp',
      range_type: 'normal',
    })

    expect(mockRequireAdmin).toHaveBeenCalled()
    expect(insertCalls.length).toBe(1)
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'create',
        entityType: 'reference_range',
        entityId: 'r-1',
      })
    )
    expect(result).toEqual({ success: true, rangeId: 'r-1' })
  })

  it('returns error on supabase failure', async () => {
    queryResult = { data: null, error: { message: 'Insert failed' } }

    const result = await createRange({
      biomarker_id: '123e4567-e89b-12d3-a456-426614174000',
      unit: 'mg/dL',
      sex: 'general',
      range_low: 70,
      range_high: 99,
      source: 'Lab Corp',
      range_type: 'normal',
    })

    expect(result).toEqual({ success: false, error: 'Insert failed' })
  })
})

describe('updateRange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
    mockWriteAuditLog.mockResolvedValue({ success: true })
  })

  it('calls requireAdmin, updates by id, and writes audit log', async () => {
    queryResult = { data: null, error: null }

    const result = await updateRange('r-1', { range_low: 65, range_high: 100 })

    expect(mockRequireAdmin).toHaveBeenCalled()
    expect(updateCalls.length).toBe(1)
    expect(eqCalls).toContainEqual(['id', 'r-1'])
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'reference_range',
        entityId: 'r-1',
      })
    )
    expect(result).toEqual({ success: true })
  })
})

describe('deleteRange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
    mockWriteAuditLog.mockResolvedValue({ success: true })
  })

  it('calls requireAdmin, deletes by id, and writes audit log', async () => {
    queryResult = { data: null, error: null }

    const result = await deleteRange('r-1')

    expect(mockRequireAdmin).toHaveBeenCalled()
    expect(deleteCalls.length).toBe(1)
    expect(eqCalls).toContainEqual(['id', 'r-1'])
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delete',
        entityType: 'reference_range',
        entityId: 'r-1',
      })
    )
    expect(result).toEqual({ success: true })
  })
})

describe('bulkImportRanges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
    mockWriteAuditLog.mockResolvedValue({ success: true })
  })

  it('resolves biomarker names to IDs and upserts ranges', async () => {
    biomarkerQueryResult = {
      data: [
        { id: 'bio-1', name: 'Glucose' },
        { id: 'bio-2', name: 'HbA1c' },
      ],
      error: null,
    }
    queryResult = { data: null, error: null }

    const result = await bulkImportRanges([
      {
        biomarker_name: 'Glucose',
        unit: 'mg/dL',
        sex: 'general',
        age_min: '',
        age_max: '',
        range_low: '70',
        range_high: '99',
        source: 'Lab Corp',
        range_type: 'normal',
      },
    ])

    expect(mockRequireAdmin).toHaveBeenCalled()
    expect(upsertCalls.length).toBe(1)
    expect(mockWriteAuditLog).toHaveBeenCalled()
    expect(result).toEqual(
      expect.objectContaining({ success: true, imported: 1 })
    )
  })

  it('returns error for unresolved biomarker names', async () => {
    biomarkerQueryResult = {
      data: [{ id: 'bio-1', name: 'Glucose' }],
      error: null,
    }

    const result = await bulkImportRanges([
      {
        biomarker_name: 'Unknown Marker',
        unit: 'mg/dL',
        sex: 'general',
        age_min: '',
        age_max: '',
        range_low: '70',
        range_high: '99',
        source: 'Lab Corp',
        range_type: 'normal',
      },
    ])

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('Unknown Marker'),
      })
    )
  })

  it('handles case-insensitive biomarker name matching', async () => {
    biomarkerQueryResult = {
      data: [{ id: 'bio-1', name: 'Glucose' }],
      error: null,
    }
    queryResult = { data: null, error: null }

    const result = await bulkImportRanges([
      {
        biomarker_name: 'glucose',
        unit: 'mg/dL',
        sex: 'general',
        age_min: '',
        age_max: '',
        range_low: '70',
        range_high: '99',
        source: 'Lab Corp',
        range_type: 'normal',
      },
    ])

    expect(result).toEqual(
      expect.objectContaining({ success: true, imported: 1 })
    )
  })
})

describe('exportRangesCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
  })

  it('returns CSV string with correct headers', async () => {
    queryResult = {
      data: [
        {
          id: 'r-1',
          biomarker_id: 'bio-1',
          unit: 'mg/dL',
          sex: 'general',
          age_min: null,
          age_max: null,
          range_low: 70,
          range_high: 99,
          source: 'Lab Corp',
          range_type: 'normal',
          biomarkers: { name: 'Glucose' },
        },
      ],
      error: null,
    }

    const result = await exportRangesCsv()

    expect(mockRequireAdmin).toHaveBeenCalled()
    expect(result.error).toBeNull()
    expect(result.data).toContain('biomarker_name')
    expect(result.data).toContain('Glucose')
    expect(result.data).toContain('mg/dL')
  })

  it('filters by biomarkerId when provided', async () => {
    queryResult = { data: [], error: null }

    await exportRangesCsv('bio-1')

    expect(eqCalls).toContainEqual(['biomarker_id', 'bio-1'])
  })
})
