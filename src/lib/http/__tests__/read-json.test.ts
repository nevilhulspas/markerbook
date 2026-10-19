import { describe, it, expect } from 'vitest'

import { readJsonBody } from '@/lib/http/read-json'

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request('http://x/api', { method: 'POST', body, headers })

describe('readJsonBody', () => {
  it('parses a body under the limit', async () => {
    const res = await readJsonBody<{ a: number }>(post('{"a":1}'), 100)
    expect(res).toEqual({ ok: true, value: { a: 1 } })
  })

  it('refuses a body over the limit with 413', async () => {
    const res = await readJsonBody(post(JSON.stringify({ a: 'x'.repeat(200) })), 100)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(413)
  })

  it('refuses invalid JSON with 400', async () => {
    const res = await readJsonBody(post('{nope'), 100)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(400)
  })
})
