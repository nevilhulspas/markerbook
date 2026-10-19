import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRequireAdmin, mockWriteAuditLog, mockRevalidatePath } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockWriteAuditLog: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

let updateCalls: unknown[] = []
let eqCalls: Array<[string, unknown]> = []
let queryResult: { data: unknown; error: unknown } = { data: null, error: null }

function resetQueryMocks() {
  updateCalls = []
  eqCalls = []
  queryResult = { data: null, error: null }
}

function createQueryBuilder() {
  const builder: Record<string, unknown> = {
    select: () => builder,
    update: (data: unknown) => {
      updateCalls.push(data)
      return builder
    },
    eq: (col: string, val: unknown) => {
      eqCalls.push([col, val])
      return builder
    },
    single: () => builder,
    then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) => {
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

import { verifyRange, extractMayoRanges } from '../verification'

const adminUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  app_metadata: { role: 'admin' },
}

describe('verifyRange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
    mockWriteAuditLog.mockResolvedValue({ success: true })
  })

  it('sets verified_at, verified_by, source_url, range values, and writes audit log', async () => {
    queryResult = { data: null, error: null }

    const result = await verifyRange('r-1', {
      range_low: 74,
      range_high: 106,
      source: 'Mayo Clinic Laboratories',
      source_url: 'https://www.mayocliniclabs.com/test-catalog/overview/82080',
    })

    expect(result).toEqual({ success: true })

    // Check that update was called with verification fields
    expect(updateCalls.length).toBe(1)
    const updatePayload = updateCalls[0] as Record<string, unknown>
    expect(updatePayload.range_low).toBe(74)
    expect(updatePayload.range_high).toBe(106)
    expect(updatePayload.source).toBe('Mayo Clinic Laboratories')
    expect(updatePayload.source_url).toBe(
      'https://www.mayocliniclabs.com/test-catalog/overview/82080'
    )
    expect(updatePayload.verified_at).toBeDefined()
    expect(updatePayload.verified_by).toBe('admin-1')

    // Check eq was called with range ID
    expect(eqCalls).toContainEqual(['id', 'r-1'])

    // Check audit log
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'verify',
        entityType: 'reference_range',
        entityId: 'r-1',
      })
    )

    // Check revalidation
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/biomarkers')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/biomarkers')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/grid')
  })

  it('returns error with invalid source_url', async () => {
    const result = await verifyRange('r-1', {
      range_low: 74,
      range_high: 106,
      source: 'Mayo Clinic Laboratories',
      source_url: 'not-a-valid-url',
    })

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('Must be a valid URL'),
    })
  })

  it('returns error on DB failure', async () => {
    queryResult = { data: null, error: { message: 'Update failed' } }

    const result = await verifyRange('r-1', {
      range_low: 74,
      range_high: 106,
      source: 'Mayo Clinic Laboratories',
      source_url: 'https://www.mayocliniclabs.com/test-catalog/overview/82080',
    })

    expect(result).toEqual({ success: false, error: 'Update failed' })
  })

  it('returns error when requireAdmin throws', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Not authorized: admin role required'))

    await expect(
      verifyRange('r-1', {
        range_low: 74,
        range_high: 106,
        source: 'Mayo Clinic Laboratories',
        source_url: 'https://www.mayocliniclabs.com/test-catalog/overview/82080',
      })
    ).rejects.toThrow('Not authorized')
  })
})

describe('extractMayoRanges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
  })

  it('calls parseMayoHtml and returns the result', async () => {
    const html = `
      <html><body><h1>Glucose</h1>
      <table>
        <thead><tr><th>Test</th><th>Units</th><th>Reference Values</th></tr></thead>
        <tbody><tr><td>Glucose</td><td>mg/dL</td><td>70-100</td></tr></tbody>
      </table></body></html>
    `
    const result = await extractMayoRanges(html)

    expect(result.error).toBeNull()
    expect(result.testName).toBe('Glucose')
    expect(result.ranges.length).toBeGreaterThan(0)
    expect(result.ranges[0]).toMatchObject({
      component: 'Glucose',
      unit: 'mg/dL',
      range_low: 70,
      range_high: 100,
    })
  })

  it('returns error for empty HTML', async () => {
    const result = await extractMayoRanges('')

    expect(result.error).toContain('No HTML content provided')
    expect(result.ranges).toEqual([])
  })
})
