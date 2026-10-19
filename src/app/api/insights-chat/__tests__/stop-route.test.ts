/**
 * The Stop endpoint: it must end the caller's own run, and nobody else's.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }))

/** The thread row RLS would return, or null when it is not the caller's. */
let threadRow: unknown = { id: 'thread-1' }

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: threadRow, error: null }),
        }),
      }),
    }),
  }),
}))

import { POST } from '../stop/route'
import { beginRun, liveRunCount, stopRun } from '@/lib/insights/run-registry'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/insights-chat/stop', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  threadRow = { id: 'thread-1' }
  mockGetUser.mockReset()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  stopRun('thread-1')
})

describe('POST /api/insights-chat/stop', () => {
  it('aborts the thread’s live run', async () => {
    const run = beginRun('thread-1')

    const res = await POST(makeRequest({ threadId: 'thread-1' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ stopped: true })
    expect(run.signal.aborted).toBe(true)
    expect(liveRunCount()).toBe(0)
  })

  it('answers plainly when the answer already finished', async () => {
    const res = await POST(makeRequest({ threadId: 'thread-1' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ stopped: false })
  })

  it('will not stop a run on someone else’s thread', async () => {
    // RLS returns no row for a thread the caller does not own.
    const run = beginRun('thread-1')
    threadRow = null

    const res = await POST(makeRequest({ threadId: 'thread-1' }))

    expect(res.status).toBe(404)
    expect(run.signal.aborted).toBe(false)
    stopRun('thread-1') // tidy up
  })

  it('rejects an unauthenticated caller', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await POST(makeRequest({ threadId: 'thread-1' }))

    expect(res.status).toBe(401)
  })

  it('rejects a request with no thread', async () => {
    const res = await POST(makeRequest({}))

    expect(res.status).toBe(400)
  })
})
