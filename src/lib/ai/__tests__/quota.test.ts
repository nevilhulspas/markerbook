import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))
const rpc = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: { rpc: (...a: unknown[]) => rpc(...a) } }))

import { AI_LIMIT_REACHED, aiLimits, countedAiCall, takeAiRequest } from '@/lib/ai/quota'

describe('takeAiRequest', () => {
  beforeEach(() => {
    rpc.mockReset()
    delete process.env.AI_REQUESTS_PER_HOUR
    delete process.env.AI_REQUESTS_PER_DAY
  })
  afterEach(() => {
    delete process.env.AI_REQUESTS_PER_HOUR
    delete process.env.AI_REQUESTS_PER_DAY
  })

  it('uses 60 per hour and 300 per day by default', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    expect(aiLimits()).toEqual({ perHour: 60, perDay: 300 })
    expect(await takeAiRequest('u1')).toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('take_ai_request', { p_user_id: 'u1', p_per_hour: 60, p_per_day: 300 })
  })

  it('refuses when the database says the user is over the limit', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    expect(await takeAiRequest('u1')).toEqual({ ok: false, error: AI_LIMIT_REACHED })
  })

  it('fails closed when the check itself fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'down' } })
    const res = await takeAiRequest('u1')
    expect(res.ok).toBe(false)
  })

  it('reads the limits from the environment, and 0 for both switches the check off', async () => {
    process.env.AI_REQUESTS_PER_HOUR = '0'
    process.env.AI_REQUESTS_PER_DAY = '0'
    expect(await takeAiRequest('u1')).toEqual({ ok: true })
    expect(rpc).not.toHaveBeenCalled()
    process.env.AI_REQUESTS_PER_HOUR = '5'
    process.env.AI_REQUESTS_PER_DAY = 'abc'
    expect(aiLimits()).toEqual({ perHour: 5, perDay: 300 })
  })
})

describe('countedAiCall', () => {
  beforeEach(() => rpc.mockReset())

  it('takes one request per call and runs the call', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    const fn = vi.fn(async (x: number) => x * 2)
    const counted = countedAiCall('u1', fn, -1)
    expect(await counted(2)).toBe(4)
    expect(await counted(3)).toBe(6)
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it('skips the call and returns the fallback over the limit', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    const fn = vi.fn(async () => 1)
    expect(await countedAiCall('u1', fn, null)()).toBeNull()
    expect(fn).not.toHaveBeenCalled()
  })
})
