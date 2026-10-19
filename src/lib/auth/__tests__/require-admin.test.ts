import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}))

import { requireAdmin } from '../require-admin'

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns AdminUser when user has admin role', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'admin@test.com',
          app_metadata: { role: 'admin' },
        },
      },
      error: null,
    })

    const result = await requireAdmin()

    expect(result).toEqual({
      id: 'user-123',
      email: 'admin@test.com',
      app_metadata: { role: 'admin' },
    })
  })

  it('throws Not authenticated when getUser returns no user', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'No session' },
    })

    await expect(requireAdmin()).rejects.toThrow('Not authenticated')
  })

  it('throws Not authorized when user role is not admin', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-456',
          email: 'user@test.com',
          app_metadata: { role: undefined },
        },
      },
      error: null,
    })

    await expect(requireAdmin()).rejects.toThrow(
      'Not authorized: admin role required'
    )
  })

  it('throws Not authorized when app_metadata is undefined', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-789',
          email: 'user@test.com',
          app_metadata: undefined,
        },
      },
      error: null,
    })

    await expect(requireAdmin()).rejects.toThrow(
      'Not authorized: admin role required'
    )
  })
})
