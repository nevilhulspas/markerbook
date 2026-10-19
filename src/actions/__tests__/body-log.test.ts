import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUser, mockRevalidatePath } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

let insertCalls: Array<Record<string, unknown>> = []
let insertError: unknown = null

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      insert: (data: Record<string, unknown>) => {
        insertCalls.push(data)
        return Promise.resolve({ error: insertError })
      },
    })),
  })),
}))

import { AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js'

import { saveLogEntry } from '../body-log'
import { AUTH_UNAVAILABLE_MESSAGE } from '@/lib/supabase/session'

describe('saveLogEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertCalls = []
    insertError = null
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('inserts a valid entry with the user id', async () => {
    const r = await saveLogEntry({ logged_on: '2026-05-27', weight_kg: 86.4, body_fat_pct: 24 })
    expect(r.error).toBeNull()
    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0]).toMatchObject({ user_id: 'user-1', logged_on: '2026-05-27', weight_kg: 86.4, body_fat_pct: 24, waist_cm: null })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/body')
  })

  it('says "signed in" when there is no session, and names an auth outage as such', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const entry = { logged_on: '2026-05-27', weight_kg: 86.4 }

    mockGetUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() })
    expect((await saveLogEntry(entry)).error).toBe('You must be signed in.')

    mockGetUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError('fetch failed', 0) })
    expect((await saveLogEntry(entry)).error).toBe(AUTH_UNAVAILABLE_MESSAGE)
    expect(insertCalls).toHaveLength(0)
  })

  it('rejects an empty entry before any DB call', async () => {
    const r = await saveLogEntry({ logged_on: '2026-05-27' })
    expect(r.error).toMatch(/at least one/i)
    expect(insertCalls).toHaveLength(0)
  })

  it('requires authentication', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const r = await saveLogEntry({ logged_on: '2026-05-27', weight_kg: 80 })
    expect(r.error).toMatch(/signed in/i)
    expect(insertCalls).toHaveLength(0)
  })
})
