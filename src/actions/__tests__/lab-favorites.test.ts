import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

import { getFavoriteLabIds } from '@/actions/lab-favorites'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
})

describe('getFavoriteLabIds', () => {
  it('returns the set of favorited lab ids for the user', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () =>
          Promise.resolve({ data: [{ lab_id: 'l1' }, { lab_id: 'l2' }] }),
      }),
    })
    const ids = await getFavoriteLabIds()
    expect(ids).toEqual(new Set(['l1', 'l2']))
  })

  it('returns empty set when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    expect(await getFavoriteLabIds()).toEqual(new Set())
  })
})
