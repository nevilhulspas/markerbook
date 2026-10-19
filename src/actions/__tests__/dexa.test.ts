import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUser, mockRevalidatePath } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

let scanRow: unknown = null
let regionRows: unknown[] = []
let upsertCalls: Array<{ data: unknown; opts: unknown }> = []

function reset() {
  scanRow = null
  regionRows = []
  upsertCalls = []
}

function fromBuilder(table: string) {
  const b: Record<string, unknown> = {
    select: () => b,
    eq: () => b,
    order: () => Promise.resolve({ data: table === 'dexa_scans' ? [] : regionRows, error: null }),
    maybeSingle: () => Promise.resolve({ data: scanRow, error: null }),
    upsert: (data: unknown, opts: unknown) => {
      upsertCalls.push({ data, opts })
      return Promise.resolve({ error: null })
    },
    // `await from('dexa_regions').select().eq()` resolves here.
    then: (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: regionRows, error: null }).then(resolve),
  }
  return b
}

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn((t: string) => fromBuilder(t)),
    auth: { getUser: mockGetUser },
  })),
}))

import { getScan, saveGoal } from '../dexa'

describe('getScan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reset()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns null when the scan is not found', async () => {
    scanRow = null
    expect(await getScan('missing')).toBeNull()
  })

  it('returns the scan with its regions', async () => {
    scanRow = { id: 'scan-1', body_fat_pct: 26.2 }
    regionRows = [{ id: 'r1', scan_id: 'scan-1', region: 'trunk' }]
    const out = await getScan('scan-1')
    expect(out?.scan).toMatchObject({ id: 'scan-1' })
    expect(out?.regions).toHaveLength(1)
    expect(out?.regions[0].region).toBe('trunk')
  })
})

describe('saveGoal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reset()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('upserts the goal on (user_id, metric)', async () => {
    const r = await saveGoal('body_fat_pct', 18)
    expect(r.error).toBeNull()
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0].data).toMatchObject({ user_id: 'user-1', metric: 'body_fat_pct', target_value: 18 })
    expect(upsertCalls[0].opts).toMatchObject({ onConflict: 'user_id,metric' })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/body')
  })

  it('requires authentication', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const r = await saveGoal('body_fat_pct', 18)
    expect(r.error).toMatch(/authenticated/i)
    expect(upsertCalls).toHaveLength(0)
  })
})
