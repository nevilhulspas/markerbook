import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ScrapeJob } from '@/lib/database.types'

const { mockRequireAdmin } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
}))

// Controllable result for scrape_jobs.select(...).eq(...).maybeSingle().
let jobRow: ScrapeJob | null = null
let jobError: { message: string } | null = null
// Recorded update calls (used to assert the best-effort stale persist).
let updateCalls: Array<{ table: string; data: unknown }> = []
// Controllable result for the get_latest_scrape_jobs() RPC.
let rpcResult: { data: unknown; error: unknown } = { data: [], error: null }

function resetMocks() {
  jobRow = null
  jobError = null
  updateCalls = []
  rpcResult = { data: [], error: null }
}

/**
 * Minimal chainable builder for the scrape_jobs table.
 *  - select(...).eq(...).maybeSingle() resolves to { data: jobRow }
 *  - update(...).eq(...) records the call and resolves (then-able)
 */
function createBuilder(table: string) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () =>
      Promise.resolve(jobError ? { data: null, error: jobError } : { data: jobRow, error: null }),
    update: (data: unknown) => {
      updateCalls.push({ table, data })
      const updateResult = {
        eq: () => ({
          then: (
            resolve: (val: unknown) => void,
            reject?: (err: unknown) => void
          ) => Promise.resolve({ data: null, error: null }).then(resolve, reject),
        }),
      }
      return updateResult
    },
  }
  return builder
}

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => createBuilder(table)),
    rpc: vi.fn(() => Promise.resolve(rpcResult)),
  },
}))

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: mockRequireAdmin,
}))

import { getScrapeJob, getLatestScrapeJobs } from '../scrape-jobs'

const adminUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  app_metadata: { role: 'admin' },
}

function makeJob(overrides: Partial<ScrapeJob>): ScrapeJob {
  return {
    id: 'job-1',
    lab_id: 'lab-1',
    status: 'done',
    logs: 'line one\nline two',
    inserted: 3,
    skipped: 1,
    profile_updated: true,
    error: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('getScrapeJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
  })

  it('returns the row as-is for a terminal job', async () => {
    jobRow = makeJob({ status: 'done' })

    const result = await getScrapeJob('job-1')

    expect(result).toEqual(jobRow)
    // No stale flip, so no best-effort update.
    expect(updateCalls).toHaveLength(0)
  })

  it('returns null when the job does not exist', async () => {
    jobRow = null

    const result = await getScrapeJob('missing')

    expect(result).toBeNull()
  })

  it('throws on a read error instead of reporting the job as missing', async () => {
    jobRow = makeJob({ status: 'running' })
    jobError = { message: 'connection reset' }

    await expect(getScrapeJob('job-1')).rejects.toThrow('connection reset')
  })

  it('does NOT flip a recently-updated running job', async () => {
    jobRow = makeJob({
      status: 'running',
      error: null,
      updated_at: new Date().toISOString(),
    })

    const result = await getScrapeJob('job-1')

    expect(result?.status).toBe('running')
    expect(updateCalls).toHaveLength(0)
  })

  it('overrides a stale running job to error (and best-effort persists it)', async () => {
    const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    jobRow = makeJob({ status: 'running', error: null, updated_at: stale })

    const result = await getScrapeJob('job-1')

    expect(result?.status).toBe('error')
    expect(result?.error).toBe(
      'Interrupted — the server restarted during the scrape. Run it again.'
    )

    // Best-effort persist of the flip.
    const persisted = updateCalls.find((c) => c.table === 'scrape_jobs')
    expect(persisted).toBeDefined()
    const patch = persisted!.data as Record<string, unknown>
    expect(patch.status).toBe('error')
    expect(patch.error).toBe(
      'Interrupted — the server restarted during the scrape. Run it again.'
    )
  })

  it('propagates a requireAdmin rejection', async () => {
    mockRequireAdmin.mockRejectedValue(
      new Error('Not authorized: admin role required')
    )

    await expect(getScrapeJob('job-1')).rejects.toThrow()
  })
})

describe('getLatestScrapeJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
  })

  it('keys the RPC rows by lab_id and applies the stale check', async () => {
    const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    rpcResult = {
      data: [
        makeJob({ id: 'j1', lab_id: 'lab-1', status: 'done' }),
        makeJob({ id: 'j2', lab_id: 'lab-2', status: 'running', error: null, updated_at: stale }),
      ],
      error: null,
    }

    const result = await getLatestScrapeJobs()

    expect(Object.keys(result).sort()).toEqual(['lab-1', 'lab-2'])
    expect(result['lab-1'].status).toBe('done')
    // A stale running job is flipped to error by withStaleCheck.
    expect(result['lab-2'].status).toBe('error')
  })

  it('returns {} when the RPC errors', async () => {
    rpcResult = { data: null, error: { message: 'boom' } }

    expect(await getLatestScrapeJobs()).toEqual({})
  })

  it('propagates a requireAdmin rejection', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Not authorized'))

    await expect(getLatestScrapeJobs()).rejects.toThrow()
  })
})
