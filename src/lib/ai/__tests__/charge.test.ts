import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockTake } = vi.hoisted(() => ({ mockTake: vi.fn() }))
vi.mock('../quota', () => ({ takeAiRequest: mockTake }))

import { chargeAiCall, runChargingAiCalls } from '../charge'

describe('chargeAiCall', () => {
  beforeEach(() => mockTake.mockReset())

  it('is a no-op outside a charged run (admin scrape)', async () => {
    await chargeAiCall()
    expect(mockTake).not.toHaveBeenCalled()
  })

  it("takes one request per call from the run's user, across awaits", async () => {
    mockTake.mockResolvedValue({ ok: true })
    await runChargingAiCalls('user-1', async () => {
      await chargeAiCall()
      await new Promise((r) => setTimeout(r, 1))
      await chargeAiCall()
    })
    expect(mockTake.mock.calls).toEqual([['user-1'], ['user-1']])
  })

  it('throws over the limit so the model call never runs', async () => {
    mockTake.mockResolvedValue({ ok: false, error: 'limit' })
    await expect(runChargingAiCalls('user-1', () => chargeAiCall())).rejects.toThrow('limit')
  })
})
