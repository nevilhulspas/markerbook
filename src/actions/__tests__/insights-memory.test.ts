// AUT-854 follow-up: per-file list + delete actions for the Health AI's
// memory. Mirrors the in-memory Supabase mock pattern used by the other
// action tests; both user-context and admin clients hit the same shared
// `rows` array so the test sees writes from either.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }))

type Row = Record<string, unknown> & { id: string }
let rows: Row[] = []

function reset() {
  rows = []
  mockGetUser.mockReset()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
}

function createBuilder() {
  const filters: Array<[string, unknown]> = []
  const matched = () =>
    rows.filter((r) => filters.every(([k, v]) => r[k] === v))

  const builder: Record<string, unknown> = {
    select() {
      return builder
    },
    eq(col: string, val: unknown) {
      filters.push([col, val])
      return builder
    },
    order() {
      return builder
    },
    delete() {
      const chain: Record<string, unknown> = {
        eq(col: string, val: unknown) {
          filters.push([col, val])
          return chain
        },
        // Per-file delete chains .select().single() (PGRST116 on zero-row).
        select: () => chain,
        single: () => {
          const ms = matched()
          if (ms.length === 0) {
            return Promise.resolve({
              data: null,
              error: { code: 'PGRST116', message: 'no rows' },
            })
          }
          ms.forEach((r) => {
            const idx = rows.indexOf(r)
            if (idx >= 0) rows.splice(idx, 1)
          })
          return Promise.resolve({ data: ms[0], error: null })
        },
        // Bulk clear awaits the builder directly.
        then(resolve: (v: unknown) => unknown) {
          const ms = matched()
          ms.forEach((r) => {
            const idx = rows.indexOf(r)
            if (idx >= 0) rows.splice(idx, 1)
          })
          return resolve({ error: null })
        },
      }
      return chain
    },
    then(resolve: (v: unknown) => unknown) {
      return resolve({ data: matched(), error: null })
    },
  }
  return builder
}

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: () => createBuilder(),
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: () => createBuilder() },
}))

import {
  listInsightsMemory,
  deleteInsightsMemoryFile,
  clearInsightsMemory,
} from '@/actions/insights-memory'

describe('insights memory actions', () => {
  beforeEach(reset)

  it('listInsightsMemory returns only the current user files', async () => {
    rows.push({
      id: 'm-1',
      user_id: 'user-1',
      path: '/memories/preferences.md',
      content: 'Prefers fasting blood draws',
      updated_at: '2026-05-28T10:00:00Z',
    })
    rows.push({
      id: 'm-2',
      user_id: 'someone-else',
      path: '/memories/other.md',
      content: 'should not appear',
      updated_at: '2026-05-28T11:00:00Z',
    })
    const out = await listInsightsMemory()
    expect(out).toHaveLength(1)
    expect(out[0].path).toBe('/memories/preferences.md')
  })

  it('listInsightsMemory returns [] when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    expect(await listInsightsMemory()).toEqual([])
  })

  it('deleteInsightsMemoryFile removes an owned row', async () => {
    rows.push({
      id: 'm-1',
      user_id: 'user-1',
      path: '/memories/x.md',
      content: 'x',
      updated_at: '2026-05-28T10:00:00Z',
    })
    const r = await deleteInsightsMemoryFile('m-1')
    expect(r.error).toBeNull()
    expect(rows).toHaveLength(0)
  })

  it('deleteInsightsMemoryFile surfaces PGRST116 for nonexistent id', async () => {
    const r = await deleteInsightsMemoryFile('nope')
    expect(r.error).toBeTruthy()
  })

  it('deleteInsightsMemoryFile rejects unauthenticated callers', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const r = await deleteInsightsMemoryFile('m-1')
    expect(r.error).toBe('Not authenticated')
  })

  it('clearInsightsMemory removes every file for the current user', async () => {
    rows.push({
      id: 'm-1',
      user_id: 'user-1',
      path: '/memories/a.md',
      content: 'a',
      updated_at: '2026-05-28T10:00:00Z',
    })
    rows.push({
      id: 'm-2',
      user_id: 'user-1',
      path: '/memories/b.md',
      content: 'b',
      updated_at: '2026-05-28T11:00:00Z',
    })
    rows.push({
      id: 'm-3',
      user_id: 'someone-else',
      path: '/memories/c.md',
      content: 'c',
      updated_at: '2026-05-28T12:00:00Z',
    })
    const r = await clearInsightsMemory()
    expect(r.error).toBeNull()
    // Other-user row survives
    expect(rows).toHaveLength(1)
    expect(rows[0].user_id).toBe('someone-else')
  })
})
