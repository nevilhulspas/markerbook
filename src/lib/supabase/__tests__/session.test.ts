import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  AuthApiError,
  AuthInvalidJwtError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  AuthUnknownError,
} from '@supabase/supabase-js'

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }))
const client = { auth: { getUser: mockGetUser } }
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => client }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

import { AUTH_UNAVAILABLE_MESSAGE, getSessionUser, isAuthOutage, notFoundOrAuthOutage } from '@/lib/supabase/session'
import { throwIfAuthOutage } from '@/lib/supabase/auth-outage'

const OUTAGES = [
  new AuthRetryableFetchError('fetch failed', 0),
  new AuthApiError('upstream error', 503, undefined),
  new AuthUnknownError('weird', new Error('x')),
]
const SIGNED_OUT = [
  new AuthSessionMissingError(),
  new AuthApiError('invalid JWT', 401, 'bad_jwt'),
  new AuthApiError('user not found', 404, 'user_not_found'),
]

beforeEach(() => {
  mockGetUser.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('getSessionUser', () => {
  it('returns the request client and the signed-in user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    await expect(getSessionUser()).resolves.toEqual({ supabase: client, user: { id: 'u1' }, authError: null })
  })

  it('returns a null user and no authError when signed out', async () => {
    for (const error of SIGNED_OUT) {
      mockGetUser.mockResolvedValue({ data: { user: null }, error })
      await expect(getSessionUser()).resolves.toEqual({ supabase: client, user: null, authError: null })
    }
  })

  it('returns the outage message (not a throw) when the auth service or network fails', async () => {
    for (const error of OUTAGES) {
      mockGetUser.mockResolvedValue({ data: { user: null }, error })
      await expect(getSessionUser()).resolves.toEqual({
        supabase: client,
        user: null,
        authError: AUTH_UNAVAILABLE_MESSAGE,
      })
    }
  })

  it('keeps a returned user even when an outage error comes with it', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: OUTAGES[1] })
    await expect(getSessionUser()).resolves.toEqual({ supabase: client, user: { id: 'u1' }, authError: null })
  })
})

describe('isAuthOutage', () => {
  it('classifies auth errors', () => {
    expect(isAuthOutage(null)).toBe(false)
    expect(isAuthOutage(new AuthInvalidJwtError('bad'))).toBe(false)
    expect(isAuthOutage(new AuthApiError('bad request', 400, undefined))).toBe(false)
    for (const e of SIGNED_OUT) expect(isAuthOutage(e)).toBe(false)
    for (const e of OUTAGES) expect(isAuthOutage(e)).toBe(true)
  })
})

describe('throwIfAuthOutage', () => {
  it('throws only for an outage without a user', () => {
    expect(() => throwIfAuthOutage(null, OUTAGES[0])).toThrow(AUTH_UNAVAILABLE_MESSAGE)
    expect(() => throwIfAuthOutage(null, SIGNED_OUT[0])).not.toThrow()
    expect(() => throwIfAuthOutage({ id: 'u1' } as never, OUTAGES[0])).not.toThrow()
    expect(() => throwIfAuthOutage(null, null)).not.toThrow()
  })
})

describe('notFoundOrAuthOutage', () => {
  it('is a 404 normally, but the error page during an auth outage', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    await expect(notFoundOrAuthOutage()).rejects.toThrow('NEXT_NOT_FOUND')

    mockGetUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() })
    await expect(notFoundOrAuthOutage()).rejects.toThrow('NEXT_NOT_FOUND')

    mockGetUser.mockResolvedValue({ data: { user: null }, error: OUTAGES[0] })
    await expect(notFoundOrAuthOutage()).rejects.toThrow(AUTH_UNAVAILABLE_MESSAGE)
  })

  it('trusts an outage the action already reported, even if auth has recovered', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    await expect(notFoundOrAuthOutage(AUTH_UNAVAILABLE_MESSAGE)).rejects.toThrow(AUTH_UNAVAILABLE_MESSAGE)
    expect(mockGetUser).not.toHaveBeenCalled()
    await expect(notFoundOrAuthOutage('Test not found')).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
