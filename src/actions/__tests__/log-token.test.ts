import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSessionUser, readResult, adminUpdate } = vi.hoisted(() => ({
  mockSessionUser: vi.fn(),
  readResult: { current: { data: null as unknown, error: null as unknown } },
  adminUpdate: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/session', () => ({ getSessionUser: mockSessionUser }))
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: () => ({
      update: (values: unknown) => {
        const filters: Array<[string, unknown]> = []
        const chain = {
          eq: (col: string, v: unknown) => (filters.push([col, v]), chain),
          is: (col: string, v: unknown) => (filters.push([`is:${col}`, v]), chain),
          select: () => chain,
          maybeSingle: () => Promise.resolve(adminUpdate(values, filters)),
          single: () => Promise.resolve(adminUpdate(values, filters)),
        }
        return chain
      },
    }),
  },
}))

import { getOrCreateLogToken } from '../nutrition-settings'

function userClient() {
  const chain = {
    select: () => chain,
    eq: () => chain,
    single: () => Promise.resolve(readResult.current),
    maybeSingle: () => Promise.resolve(readResult.current),
  }
  return { from: () => chain }
}

describe('getOrCreateLogToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionUser.mockResolvedValue({ supabase: userClient(), user: { id: 'u1' }, authError: null })
  })

  it('returns the stored token without writing', async () => {
    readResult.current = { data: { nutrition_log_token: 'existing' }, error: null }
    expect(await getOrCreateLogToken()).toEqual({ token: 'existing', error: null })
    expect(adminUpdate).not.toHaveBeenCalled()
  })

  it('never replaces a token when the profile read fails', async () => {
    readResult.current = { data: null, error: { message: 'network down' } }
    expect(await getOrCreateLogToken()).toEqual({ token: null, error: 'network down' })
    expect(adminUpdate).not.toHaveBeenCalled()
  })

  it('creates a token only while the column is still empty', async () => {
    readResult.current = { data: { nutrition_log_token: null }, error: null }
    adminUpdate.mockImplementation((values: { nutrition_log_token: string }) => ({
      data: { nutrition_log_token: values.nutrition_log_token },
      error: null,
    }))
    const res = await getOrCreateLogToken()
    expect(res.error).toBeNull()
    expect(res.token).toMatch(/^[0-9a-f-]{36}$/)
    expect(adminUpdate.mock.calls[0][1]).toEqual([
      ['id', 'u1'],
      ['is:nutrition_log_token', null],
    ])
  })

  it('returns the token another request just created instead of overwriting it', async () => {
    readResult.current = { data: { nutrition_log_token: null }, error: null }
    adminUpdate.mockReturnValue({ data: null, error: null }) // 0 rows: column no longer empty
    // The re-read after the lost race sees the winner's token.
    mockSessionUser.mockResolvedValue({
      supabase: (() => {
        let reads = 0
        const chain = {
          select: () => chain,
          eq: () => chain,
          single: () =>
            Promise.resolve(
              reads++ === 0
                ? { data: { nutrition_log_token: null }, error: null }
                : { data: { nutrition_log_token: 'winner' }, error: null }
            ),
        }
        return { from: () => chain }
      })(),
      user: { id: 'u1' },
      authError: null,
    })
    expect(await getOrCreateLogToken()).toEqual({ token: 'winner', error: null })
  })
})
