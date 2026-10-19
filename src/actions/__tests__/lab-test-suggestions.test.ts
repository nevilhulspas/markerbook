import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUser, mockRevalidatePath, mockSuggestCore, SuggestTestError } = vi.hoisted(() => {
  // Defined inside vi.hoisted so the class is available when vi.mock factories run
  // (vi.mock is hoisted to the top of the file, before class declarations).
  class SuggestTestError extends Error {}
  return {
    mockGetUser: vi.fn(),
    mockRevalidatePath: vi.fn(),
    mockSuggestCore: vi.fn(),
    SuggestTestError,
  }
})

let rateCount = 0
let rateError: unknown = null

function createBuilder() {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    gt: () => builder,
    then: (resolve: (v: unknown) => unknown) =>
      resolve({ data: null, error: rateError, count: rateCount }),
  }
  return builder
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: () => createBuilder() },
}))
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('@/lib/labs/suggest-test', () => ({
  suggestLabTestFromUrl: mockSuggestCore,
  SuggestTestError,
}))

import { suggestLabTest } from '@/actions/lab-test-suggestions'

const LAB_ID = '11111111-1111-4111-8111-111111111111'
const GOOD = { labId: LAB_ID, url: 'https://bodimed.com/produkt/reverse-t3/' }

describe('suggestLabTest', () => {
  beforeEach(() => {
    rateCount = 0
    rateError = null
    mockGetUser.mockReset()
    mockRevalidatePath.mockReset()
    mockSuggestCore.mockReset()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSuggestCore.mockResolvedValue({ added: ['Reverse T3'], duplicates: [] })
  })

  it('rejects an invalid payload', async () => {
    const r = await suggestLabTest({ labId: 'nope', url: 'x' })
    expect(r.error).toBeTruthy()
    expect(mockSuggestCore).not.toHaveBeenCalled()
  })

  it('rejects when not signed in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const r = await suggestLabTest(GOOD)
    expect(r.error).toMatch(/signed in/i)
    expect(mockSuggestCore).not.toHaveBeenCalled()
  })

  it('rejects when over the hourly rate limit', async () => {
    rateCount = 20
    const r = await suggestLabTest(GOOD)
    expect(r.error).toBeTruthy()
    expect(mockSuggestCore).not.toHaveBeenCalled()
  })

  it('fails closed when the rate-limit count query errors', async () => {
    rateError = { message: 'db down' }
    const r = await suggestLabTest(GOOD)
    expect(r.data).toBeNull()
    expect(r.error).toBeTruthy()
    expect(mockSuggestCore).not.toHaveBeenCalled()
  })

  it('happy path: calls core, revalidates, returns result', async () => {
    const r = await suggestLabTest(GOOD)
    expect(mockSuggestCore).toHaveBeenCalledWith({ labId: LAB_ID, url: GOOD.url, userId: 'user-1' })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/labs/' + LAB_ID)
    expect(r).toEqual({ data: { added: ['Reverse T3'], duplicates: [] }, error: null })
  })

  it('maps a SuggestTestError to its message', async () => {
    mockSuggestCore.mockRejectedValue(new SuggestTestError("That page isn't on this lab's website."))
    const r = await suggestLabTest(GOOD)
    expect(r).toEqual({ data: null, error: "That page isn't on this lab's website." })
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('maps an unexpected error to a generic message', async () => {
    mockSuggestCore.mockRejectedValue(new Error('kaboom'))
    const r = await suggestLabTest(GOOD)
    expect(r.data).toBeNull()
    expect(r.error).toMatch(/something went wrong/i)
  })
})
