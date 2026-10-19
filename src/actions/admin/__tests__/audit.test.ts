import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInsert, mockRequireAdmin } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockRequireAdmin: vi.fn(),
}))

// Track calls for assertions
let selectCalls: string[] = []
let orderCalls: Array<[string, { ascending: boolean }]> = []
let limitCalls: number[] = []
let eqCalls: Array<[string, string]> = []
let queryResult: { data: unknown; error: unknown } = { data: null, error: null }

function resetQueryMocks() {
  selectCalls = []
  orderCalls = []
  limitCalls = []
  eqCalls = []
  queryResult = { data: null, error: null }
}

// Build a chainable mock that also implements PromiseLike
function createChainableQuery() {
  const builder = {
    select: (s: string) => {
      selectCalls.push(s)
      return builder
    },
    order: (col: string, opts: { ascending: boolean }) => {
      orderCalls.push([col, opts])
      return builder
    },
    limit: (n: number) => {
      limitCalls.push(n)
      return builder
    },
    eq: (col: string, val: string) => {
      eqCalls.push([col, val])
      return builder
    },
    then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) => {
      return Promise.resolve(queryResult).then(resolve, reject)
    },
  }
  return builder
}

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: mockInsert,
      ...createChainableQuery(),
    })),
  },
}))

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: mockRequireAdmin,
}))

import { getAuditLogs } from '../audit'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

describe('writeAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
  })

  it('inserts a correctly shaped row into audit_logs', async () => {
    mockInsert.mockResolvedValue({ error: null })

    const entry = {
      userId: 'user-123',
      action: 'create' as const,
      entityType: 'biomarker' as const,
      entityId: 'entity-456',
      changes: { name: 'Hemoglobin' },
    }

    const result = await writeAuditLog(entry)

    expect(result).toEqual({ success: true })
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        action: 'create',
        entity_type: 'biomarker',
        entity_id: 'entity-456',
        changes: { name: 'Hemoglobin' },
      })
    )
  })

  it('returns error when insert fails', async () => {
    mockInsert.mockResolvedValue({
      error: { message: 'Insert failed' },
    })

    const entry = {
      userId: 'user-123',
      action: 'update' as const,
      entityType: 'biomarker' as const,
      entityId: 'entity-456',
      changes: {},
    }

    const result = await writeAuditLog(entry)

    expect(result).toEqual({ success: false, error: 'Insert failed' })
  })
})

describe('getAuditLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
    mockRequireAdmin.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@test.com',
      app_metadata: { role: 'admin' },
    })
  })

  it('calls requireAdmin before querying', async () => {
    queryResult = { data: [], error: null }

    await getAuditLogs({})

    expect(mockRequireAdmin).toHaveBeenCalled()
  })

  it('returns ordered audit entries with default limit of 50', async () => {
    const mockData = [
      {
        id: 'log-1',
        user_id: 'user-123',
        action: 'create',
        entity_type: 'biomarker',
        entity_id: 'entity-456',
        changes: {},
        created_at: '2026-04-03T00:00:00Z',
      },
    ]

    queryResult = { data: mockData, error: null }

    const result = await getAuditLogs({})

    expect(result).toEqual({ data: mockData, error: null })
    expect(orderCalls).toEqual([['created_at', { ascending: false }]])
    expect(limitCalls).toEqual([50])
  })
})
