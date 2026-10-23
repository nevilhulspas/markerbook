import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')

const { mockGetUser, mockRunScrapeJob, mockRevalidatePath } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRunScrapeJob: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

// Controllable state for the supabaseAdmin mock.
let pendingCount = 0
let allLabs: Array<{ id: string; name: string | null; website: string | null; status: string }> = []
let labInsertError: unknown = null
let labInsertCalls: Array<Record<string, unknown>> = []
let jobInsertCalls: Array<Record<string, unknown>> = []

function reset() {
  pendingCount = 0
  allLabs = []
  labInsertError = null
  labInsertCalls = []
  jobInsertCalls = []
}

function labsBuilder() {
  const b: Record<string, unknown> = {
    _head: false,
    select(_cols: string, opts?: { head?: boolean }) {
      b._head = Boolean(opts?.head)
      return b
    },
    eq() {
      return b
    },
    insert(data: Record<string, unknown>) {
      labInsertCalls.push(data)
      return {
        select: () => ({
          single: () =>
            Promise.resolve({
              data: labInsertError ? null : { id: 'lab-new' },
              error: labInsertError,
            }),
        }),
      }
    },
    then(resolve: (v: unknown) => void) {
      const res = b._head
        ? { count: pendingCount, data: null, error: null }
        : { data: allLabs, error: null }
      return Promise.resolve(res).then(resolve)
    },
  }
  return b
}

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
}))
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'scrape_jobs') {
        return {
          insert: (data: Record<string, unknown>) => {
            jobInsertCalls.push(data)
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'job-1' }, error: null }),
              }),
            }
          },
        }
      }
      return labsBuilder()
    }),
  },
}))
vi.mock('@/lib/labs/run-scrape', () => ({ runScrapeJob: mockRunScrapeJob }))

import { submitLab } from '../labs'

const user = { id: 'user-1' }

describe('submitLab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reset()
    mockGetUser.mockResolvedValue({ data: { user } })
    mockRunScrapeJob.mockResolvedValue(undefined)
  })

  it('rejects invalid input before any work', async () => {
    const r = await submitLab({ name: '', website: 'nope' })
    expect(r.error).toBeTruthy()
    expect(r.data).toBeNull()
    expect(labInsertCalls).toHaveLength(0)
  })

  it('requires authentication', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const r = await submitLab({ name: 'Acme', website: 'https://acme.example' })
    expect(r.error).toMatch(/signed in/i)
    expect(labInsertCalls).toHaveLength(0)
  })

  it('refuses when the server has no Anthropic key (the import needs AI)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    try {
      const r = await submitLab({ name: 'Acme', website: 'https://acme.example' })
      expect(r.error).toMatch(/needs AI/)
      expect(labInsertCalls).toHaveLength(0)
      expect(mockRunScrapeJob).not.toHaveBeenCalled()
    } finally {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    }
  })

  it('enforces the pending rate limit', async () => {
    pendingCount = 5
    const r = await submitLab({ name: 'Acme', website: 'https://acme.example' })
    expect(r.error).toMatch(/waiting for review/i)
    expect(labInsertCalls).toHaveLength(0)
    expect(mockRunScrapeJob).not.toHaveBeenCalled()
  })

  it('rejects a duplicate by website host', async () => {
    allLabs = [{ id: 'x', name: 'Other', website: 'https://acme.example/tests', status: 'approved' }]
    const r = await submitLab({ name: 'Acme', website: 'https://acme.example' })
    expect(r.error).toMatch(/already listed/i)
    expect(labInsertCalls).toHaveLength(0)
  })

  it('rejects a duplicate by name (case-insensitive)', async () => {
    allLabs = [{ id: 'x', name: 'ACME', website: 'https://different.example', status: 'pending' }]
    const r = await submitLab({ name: 'acme', website: 'https://acme.example' })
    expect(r.error).toMatch(/already been suggested/i)
    expect(labInsertCalls).toHaveLength(0)
  })

  it('maps a unique-violation (lost insert race) to a friendly message', async () => {
    labInsertError = { code: '23505', message: 'duplicate key value violates unique constraint' }
    const r = await submitLab({ name: 'Acme', website: 'https://acme.example' })
    expect(r.data).toBeNull()
    expect(r.error).toMatch(/already listed or waiting for review/i)
    // No scrape should be enqueued when the lab insert failed.
    expect(jobInsertCalls).toHaveLength(0)
    expect(mockRunScrapeJob).not.toHaveBeenCalled()
  })

  it('creates a pending lab + fires the scrape on the happy path', async () => {
    const r = await submitLab({
      name: '  Acme Labs ',
      website: 'https://acme.example/tests',
      country: 'NL',
    })
    expect(r.error).toBeNull()
    expect(r.data).toEqual({ labId: 'lab-new' })

    expect(labInsertCalls).toHaveLength(1)
    const row = labInsertCalls[0]
    expect(row.name).toBe('Acme Labs')
    expect(row.status).toBe('pending')
    expect(row.submitted_by).toBe('user-1')
    expect(row.website).toBe('https://acme.example/tests')

    expect(jobInsertCalls).toEqual([{ lab_id: 'lab-new', status: 'running' }])
    expect(mockRunScrapeJob).toHaveBeenCalledWith('job-1', 'lab-new')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/labs')
  })
})
