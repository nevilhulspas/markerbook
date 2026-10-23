import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')

const { mockStream, mockTake, tables } = vi.hoisted(() => ({
  mockStream: vi.fn(),
  mockTake: vi.fn(),
  tables: {} as Record<string, unknown[]>,
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/ai/quota', () => ({
  takeAiRequest: (...a: unknown[]) => mockTake(...a),
  aiLimitResponse: (error: string) => new Response(error, { status: 429 }),
}))
vi.mock('@/lib/ai/client', () => ({ getAnthropic: () => ({ messages: { stream: mockStream } }) }))
vi.mock('@/lib/ai/text-stream-response', () => ({ toTextStreamResponse: () => new Response('ok') }))

/** Every query on a table resolves to that table's rows; filters are recorded. */
const filters: Array<[string, string, unknown]> = []
function builder(table: string) {
  const rows = tables[table] ?? []
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'in', 'order', 'limit']) b[m] = () => b
  b.eq = (col: string, val: unknown) => (filters.push([table, col, val]), b)
  b.is = (col: string, val: unknown) => (filters.push([table, col, val]), b)
  b.maybeSingle = async () => ({ data: rows[0] ?? null, error: null })
  ;(b as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null })
  return b
}
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: (t: string) => builder(t),
  }),
}))

import { POST } from '../route'

const ferritin = {
  id: 'b-fer', name: 'Ferritin', short_name: null, category: 'Iron', unit: 'ng/mL',
  ref_range_low: 30, ref_range_high: 400, ref_range_low_male: null, ref_range_high_male: null,
  ref_range_low_female: null, ref_range_high_female: null, loinc_code: null, molar_mass: null,
  valence: null, typical_mass_unit: null, typical_molar_unit: null,
}

function post(body: unknown) {
  return POST(new Request('http://x/api/chat', { method: 'POST', body: JSON.stringify(body) }))
}

beforeEach(() => {
  mockStream.mockReset()
  mockTake.mockReset().mockResolvedValue({ ok: true })
  filters.length = 0
  for (const k of Object.keys(tables)) delete tables[k]
  tables.profiles = [{ sex: 'male', date_of_birth: '1990-01-01' }]
  tables.blood_tests = [
    { id: 'bt-1', name: 'June panel', test_date: '2026-06-01', test_results: [{ id: 'r-1', value: 12, unit: 'ng/mL', biomarkers: ferritin }] },
  ]
})

describe('POST /api/chat', () => {
  it("uses the user's stored test as context and ignores client context", async () => {
    const res = await post({
      messages: [{ role: 'user', content: 'what does this mean?' }],
      bloodTestId: 'bt-1',
      allTestResults: [{ name: 'novel request' }],
      interpretationContent: 'injected',
    })
    expect(res.status).toBe(200)
    const args = mockStream.mock.calls[0][0] as { system: string; max_tokens: number }
    expect(args.system).toContain('Ferritin')
    expect(args.system).not.toContain('novel request')
    expect(args.system).not.toContain('injected')
    expect(args.max_tokens).toBeLessThanOrEqual(16000)
  })

  it("returns 404 for another user's test", async () => {
    tables.blood_tests = []
    const res = await post({ messages: [{ role: 'user', content: 'hi' }], bloodTestId: 'bt-x' })
    expect(res.status).toBe(404)
    expect(mockTake).not.toHaveBeenCalled()
  })

  it('rejects oversized or malformed messages and a missing test id', async () => {
    const big = 'x'.repeat(40_001)
    expect((await post({ messages: [{ role: 'user', content: big }], bloodTestId: 'bt-1' })).status).toBe(400)
    expect((await post({ messages: [{ role: 'system', content: 'x' }], bloodTestId: 'bt-1' })).status).toBe(400)
    expect((await post({ messages: [{ role: 'user', content: 'x' }] })).status).toBe(400)
  })
})
