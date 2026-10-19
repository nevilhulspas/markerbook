import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRequireAdmin, mockWriteAuditLog, mockRevalidatePath } =
  vi.hoisted(() => ({
    mockRequireAdmin: vi.fn(),
    mockWriteAuditLog: vi.fn(),
    mockRevalidatePath: vi.fn(),
  }))

// Track query builder calls for assertions
let selectCalls: string[] = []
let orderCalls: Array<[string, { ascending: boolean }]> = []
let eqCalls: Array<[string, string]> = []
let updateCalls: unknown[] = []
let insertCalls: unknown[] = []
let queryResult: { data: unknown; error: unknown } = { data: null, error: null }

// Separate result for biomarker insert in approve flow
let biomarkerInsertResult: { data: unknown; error: unknown } = {
  data: { id: 'new-bio-1' },
  error: null,
}
let suggestionUpdateResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
}

function resetQueryMocks() {
  selectCalls = []
  orderCalls = []
  eqCalls = []
  updateCalls = []
  insertCalls = []
  queryResult = { data: null, error: null }
  biomarkerInsertResult = { data: { id: 'new-bio-1' }, error: null }
  suggestionUpdateResult = { data: null, error: null }
}

// Build a chainable mock that also implements PromiseLike
function createSuggestionsQueryBuilder() {
  const builder: Record<string, unknown> = {
    select: (s: string) => {
      selectCalls.push(s)
      return builder
    },
    order: (col: string, opts: { ascending: boolean }) => {
      orderCalls.push([col, opts])
      return builder
    },
    eq: (col: string, val: string) => {
      eqCalls.push([col, val])
      return builder
    },
    update: (data: unknown) => {
      updateCalls.push(data)
      return builder
    },
    then: (
      resolve: (val: unknown) => void,
      reject?: (err: unknown) => void
    ) => {
      return Promise.resolve(queryResult).then(resolve, reject)
    },
  }
  return builder
}

// For approve flow: biomarkers insert chain
function createBiomarkerInsertBuilder() {
  const builder: Record<string, unknown> = {
    select: (s: string) => {
      selectCalls.push(s)
      return builder
    },
    single: () => {
      return builder
    },
    then: (
      resolve: (val: unknown) => void,
      reject?: (err: unknown) => void
    ) => {
      return Promise.resolve(biomarkerInsertResult).then(resolve, reject)
    },
  }
  return builder
}

// For approve flow: suggestion update chain
function createSuggestionUpdateBuilder() {
  const builder: Record<string, unknown> = {
    eq: (col: string, val: string) => {
      eqCalls.push([col, val])
      return builder
    },
    then: (
      resolve: (val: unknown) => void,
      reject?: (err: unknown) => void
    ) => {
      return Promise.resolve(suggestionUpdateResult).then(resolve, reject)
    },
  }
  return builder
}

vi.mock('server-only', () => ({}))

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

let approvePhase: 'insert' | 'update' = 'insert'

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({
          data: {
            users: [
              { id: 'user-1', email: 'test@example.com' },
              { id: 'admin-1', email: 'admin@test.com' },
            ],
          },
        }),
      },
    },
    from: vi.fn((table: string) => {
      if (table === 'biomarkers') {
        return {
          insert: (data: unknown) => {
            insertCalls.push(data)
            return createBiomarkerInsertBuilder()
          },
        }
      }
      // marker_suggestions table
      if (approvePhase === 'update' && table === 'marker_suggestions') {
        return {
          update: (data: unknown) => {
            updateCalls.push(data)
            return createSuggestionUpdateBuilder()
          },
          select: (s: string) => {
            selectCalls.push(s)
            return createSuggestionsQueryBuilder()
          },
        }
      }
      return {
        ...createSuggestionsQueryBuilder(),
        update: (data: unknown) => {
          updateCalls.push(data)
          return createSuggestionsQueryBuilder()
        },
        insert: (data: unknown) => {
          insertCalls.push(data)
          return createSuggestionsQueryBuilder()
        },
      }
    }),
  },
}))

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: mockRequireAdmin,
}))

vi.mock('@/lib/audit/write-audit-log', () => ({
  writeAuditLog: mockWriteAuditLog,
}))

import { getSuggestions, approveSuggestion, rejectSuggestion } from '../suggestions'

const adminUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  app_metadata: { role: 'admin' },
}

describe('getSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
    approvePhase = 'insert'
  })

  it('returns suggestions ordered by created_at DESC with user email', async () => {
    const mockData = [
      { id: 's-1', user_id: 'user-1', name: 'Test Marker', status: 'pending', created_at: '2026-04-03' },
    ]
    queryResult = { data: mockData, error: null }

    const result = await getSuggestions({})

    expect(result).toEqual({
      data: [{ id: 's-1', user_id: 'user-1', name: 'Test Marker', status: 'pending', created_at: '2026-04-03', user_email: 'test@example.com' }],
      error: null,
    })
    expect(orderCalls).toEqual([['created_at', { ascending: false }]])
  })

  it('filters by status when provided', async () => {
    queryResult = { data: [], error: null }

    await getSuggestions({ status: 'pending' })

    expect(eqCalls).toContainEqual(['status', 'pending'])
  })

  it('calls requireAdmin before querying', async () => {
    queryResult = { data: [], error: null }

    await getSuggestions({})

    expect(mockRequireAdmin).toHaveBeenCalled()
  })
})

describe('rejectSuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
    mockWriteAuditLog.mockResolvedValue({ success: true })
    approvePhase = 'insert'
  })

  it('updates status to rejected with reviewed_by, review_notes, reviewed_at', async () => {
    queryResult = { data: null, error: null }

    await rejectSuggestion({
      suggestionId: 's-1',
      reviewNotes: 'Duplicate marker',
    })

    expect(updateCalls.length).toBe(1)
    const updateData = updateCalls[0] as Record<string, unknown>
    expect(updateData.status).toBe('rejected')
    expect(updateData.reviewed_by).toBe('admin-1')
    expect(updateData.review_notes).toBe('Duplicate marker')
    expect(updateData.reviewed_at).toBeDefined()
  })

  it('filters with eq status pending to only update pending suggestions', async () => {
    queryResult = { data: null, error: null }

    await rejectSuggestion({
      suggestionId: 's-1',
      reviewNotes: 'Not needed',
    })

    expect(eqCalls).toContainEqual(['status', 'pending'])
    expect(eqCalls).toContainEqual(['id', 's-1'])
  })

  it('calls writeAuditLog with action reject and entityType marker_suggestion', async () => {
    queryResult = { data: null, error: null }

    await rejectSuggestion({
      suggestionId: 's-1',
      reviewNotes: 'Not needed',
    })

    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      userId: 'admin-1',
      action: 'reject',
      entityType: 'marker_suggestion',
      entityId: 's-1',
      changes: { review_notes: 'Not needed' },
    })
  })

  it('returns error when update fails', async () => {
    queryResult = { data: null, error: { message: 'Update failed' } }

    const result = await rejectSuggestion({
      suggestionId: 's-1',
      reviewNotes: 'Reason',
    })

    expect(result).toEqual({ success: false, error: 'Update failed' })
  })
})

describe('approveSuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
    mockWriteAuditLog.mockResolvedValue({ success: true })
    approvePhase = 'insert'
  })

  it('inserts biomarker via supabaseAdmin', async () => {
    biomarkerInsertResult = { data: { id: 'new-bio-1' }, error: null }
    suggestionUpdateResult = { data: null, error: null }
    // Switch phase after insert resolves
    approvePhase = 'insert'

    await approveSuggestion({
      suggestionId: 's-1',
      biomarkerData: { name: 'New Marker', category: 'Lipids', unit: 'mg/dL' },
    })

    expect(insertCalls.length).toBeGreaterThanOrEqual(1)
    expect(insertCalls[0]).toEqual({
      name: 'New Marker',
      category: 'Lipids',
      unit: 'mg/dL',
    })
  })

  it('updates suggestion with approved status and created_biomarker_id', async () => {
    biomarkerInsertResult = { data: { id: 'new-bio-1' }, error: null }
    suggestionUpdateResult = { data: null, error: null }

    await approveSuggestion({
      suggestionId: 's-1',
      biomarkerData: { name: 'New Marker', category: 'Lipids', unit: 'mg/dL' },
    })

    // The update call should contain approved status and biomarker ID
    const approveUpdate = updateCalls.find(
      (c) => (c as Record<string, unknown>).status === 'approved'
    ) as Record<string, unknown> | undefined
    expect(approveUpdate).toBeDefined()
    expect(approveUpdate?.created_biomarker_id).toBe('new-bio-1')
    expect(approveUpdate?.reviewed_by).toBe('admin-1')
  })

  it('calls writeAuditLog with action approve and created_biomarker_id in changes', async () => {
    biomarkerInsertResult = { data: { id: 'new-bio-1' }, error: null }
    suggestionUpdateResult = { data: null, error: null }

    await approveSuggestion({
      suggestionId: 's-1',
      biomarkerData: { name: 'New Marker', category: 'Lipids', unit: 'mg/dL' },
    })

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'approve',
        entityType: 'marker_suggestion',
        entityId: 's-1',
        changes: expect.objectContaining({
          created_biomarker_id: 'new-bio-1',
        }),
      })
    )
  })

  it('returns error when biomarker creation fails', async () => {
    biomarkerInsertResult = {
      data: null,
      error: { message: 'Insert failed' },
    }

    const result = await approveSuggestion({
      suggestionId: 's-1',
      biomarkerData: { name: 'New Marker', category: 'Lipids', unit: 'mg/dL' },
    })

    expect(result).toEqual({ success: false, error: 'Insert failed' })
  })
})
