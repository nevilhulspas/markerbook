import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
}))

// Separate result variables for each query
let biomarkersNameResult: { data: unknown; error: unknown } = {
  data: [],
  error: null,
}
let allBiomarkersResult: { data: unknown; error: unknown } = {
  data: [],
  error: null,
}
let pendingCountResult: { data: unknown; error: unknown; count: number | null } = {
  data: null,
  error: null,
  count: 0,
}
let insertResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
}

let insertCalls: unknown[] = []
let fromCalls: string[] = []

function resetMocks() {
  biomarkersNameResult = { data: [], error: null }
  allBiomarkersResult = { data: [], error: null }
  pendingCountResult = { data: null, error: null, count: 0 }
  insertResult = { data: null, error: null }
  insertCalls = []
  fromCalls = []
}

// Track which query we're building to return the right result
let biomarkersQueryIndex = 0

function createBiomarkersNameBuilder() {
  const builder: Record<string, unknown> = {
    select: () => builder,
    ilike: () => builder,
    is: () => builder,
    limit: () => builder,
    then: (
      resolve: (val: unknown) => void,
      reject?: (err: unknown) => void
    ) => Promise.resolve(biomarkersNameResult).then(resolve, reject),
  }
  return builder
}

function createAllBiomarkersBuilder() {
  const builder: Record<string, unknown> = {
    select: () => builder,
    is: () => builder,
    then: (
      resolve: (val: unknown) => void,
      reject?: (err: unknown) => void
    ) => Promise.resolve(allBiomarkersResult).then(resolve, reject),
  }
  return builder
}

function createPendingCountBuilder() {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    then: (
      resolve: (val: unknown) => void,
      reject?: (err: unknown) => void
    ) => Promise.resolve(pendingCountResult).then(resolve, reject),
  }
  return builder
}

function createInsertBuilder() {
  const builder: Record<string, unknown> = {
    then: (
      resolve: (val: unknown) => void,
      reject?: (err: unknown) => void
    ) => Promise.resolve(insertResult).then(resolve, reject),
  }
  return builder
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn((table: string) => {
      fromCalls.push(table)
      if (table === 'biomarkers') {
        // First call: name ilike query, second call: all biomarkers for alias check
        const idx = biomarkersQueryIndex++
        if (idx === 0) {
          return createBiomarkersNameBuilder()
        }
        return createAllBiomarkersBuilder()
      }
      if (table === 'marker_suggestions') {
        // Distinguish count query from insert by returning object with both
        return {
          select: () => {
            // Count query: select('*', { count: 'exact', head: true })
            return createPendingCountBuilder()
          },
          insert: (data: unknown) => {
            insertCalls.push(data)
            return createInsertBuilder()
          },
        }
      }
      return {}
    }),
  }),
}))

import { submitMarkerSuggestion } from '../marker-suggestions'

describe('submitMarkerSuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    biomarkersQueryIndex = 0
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
  })

  it('returns error for invalid input (missing name)', async () => {
    const result = await submitMarkerSuggestion({
      type: 'marker',
      category: 'Hormones',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/Invalid|check your input/i)
    }
  })

  it('returns success for valid input with no duplicates and under rate limit', async () => {
    biomarkersNameResult = { data: [], error: null }
    allBiomarkersResult = { data: [], error: null }
    pendingCountResult = { data: null, error: null, count: 2 }
    insertResult = { data: null, error: null }

    const result = await submitMarkerSuggestion({
      type: 'marker',
      name: 'New Biomarker',
      category: 'Hormones',
      details: 'Some details',
    })

    expect(result.success).toBe(true)
  })

  it('rejects name matching existing biomarker name (case-insensitive)', async () => {
    biomarkersNameResult = {
      data: [{ id: 'bio-1', name: 'Cortisol' }],
      error: null,
    }
    pendingCountResult = { data: null, error: null, count: 0 }

    const result = await submitMarkerSuggestion({
      type: 'marker',
      name: 'cortisol',
      category: 'Hormones',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/already exists/i)
    }
  })

  it('rejects name matching existing biomarker alias (case-insensitive)', async () => {
    biomarkersNameResult = { data: [], error: null }
    allBiomarkersResult = {
      data: [
        { id: 'bio-1', name: 'Vitamin D', aliases: ['25-OH Vitamin D', 'Calcifediol'] },
      ],
      error: null,
    }
    pendingCountResult = { data: null, error: null, count: 0 }

    const result = await submitMarkerSuggestion({
      type: 'marker',
      name: 'calcifediol',
      category: 'Vitamins & Minerals',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/known alias/i)
    }
  })

  it('rejects user with 5 pending suggestions', async () => {
    pendingCountResult = { data: null, error: null, count: 5 }

    const result = await submitMarkerSuggestion({
      type: 'marker',
      name: 'New Marker',
      category: 'Other',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/5 pending/i)
    }
  })

  it('allows user with 4 pending suggestions to submit', async () => {
    biomarkersNameResult = { data: [], error: null }
    allBiomarkersResult = { data: [], error: null }
    pendingCountResult = { data: null, error: null, count: 4 }
    insertResult = { data: null, error: null }

    const result = await submitMarkerSuggestion({
      type: 'marker',
      name: 'Allowed Marker',
      category: 'Other',
    })

    expect(result.success).toBe(true)
  })

  it('inserts category into marker_suggestions for marker-type suggestions', async () => {
    biomarkersNameResult = { data: [], error: null }
    allBiomarkersResult = { data: [], error: null }
    pendingCountResult = { data: null, error: null, count: 0 }
    insertResult = { data: null, error: null }

    await submitMarkerSuggestion({
      type: 'marker',
      name: 'Ferritin',
      category: 'Iron Studies',
      details: 'Iron storage marker',
    })

    expect(insertCalls.length).toBe(1)
    const inserted = insertCalls[0] as Record<string, unknown>
    expect(inserted.category).toBe('Iron Studies')
    expect(inserted.name).toBe('Ferritin')
    expect(inserted.type).toBe('marker')
    expect(inserted.details).toBe('Iron storage marker')
    expect(inserted.user_id).toBe('user-1')
  })
})
