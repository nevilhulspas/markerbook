import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { mockLookup } = vi.hoisted(() => ({ mockLookup: vi.fn() }))
vi.mock('node:dns', () => ({ lookup: mockLookup }))

import { safeLookup } from '../pinned-fetch'

function run(answer: string | Array<{ address: string; family: number }>) {
  mockLookup.mockImplementation((_h: string, _o: unknown, cb: (e: null, a: unknown, f?: number) => void) =>
    cb(null, answer, 4)
  )
  return new Promise<{ err: Error | null; address: unknown }>((resolve) =>
    safeLookup('lab.example', {}, (err, address) => resolve({ err, address }))
  )
}

describe('safeLookup (connect-time DNS check)', () => {
  it('passes a public address through', async () => {
    expect(await run('93.184.216.34')).toEqual({ err: null, address: '93.184.216.34' })
  })

  it('refuses a host that now resolves to a private address (DNS rebinding)', async () => {
    for (const ip of ['169.254.169.254', '127.0.0.1', '10.0.0.5', '::1', '198.18.0.1']) {
      expect((await run(ip)).err?.message, ip).toMatch(/private address/)
    }
  })

  it('refuses when any of several answers is private (all: true)', async () => {
    const res = await run([
      { address: '93.184.216.34', family: 4 },
      { address: '192.168.1.10', family: 4 },
    ])
    expect(res.err?.message).toMatch(/private address/)
  })
})
