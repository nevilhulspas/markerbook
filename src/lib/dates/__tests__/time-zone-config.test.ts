import { describe, it, expect, vi, afterEach } from 'vitest'

async function loadZone(): Promise<string> {
  vi.resetModules()
  const mod = await import('@/lib/dates/today')
  return mod.APP_TIME_ZONE
}

describe('APP_TIME_ZONE', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('defaults to Europe/Amsterdam', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_TIME_ZONE', '')
    expect(await loadZone()).toBe('Europe/Amsterdam')
  })

  it('uses NEXT_PUBLIC_APP_TIME_ZONE when it is a valid zone', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_TIME_ZONE', 'America/New_York')
    expect(await loadZone()).toBe('America/New_York')
  })

  it('falls back to the default for an unknown zone', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('NEXT_PUBLIC_APP_TIME_ZONE', 'Mars/Olympus_Mons')
    expect(await loadZone()).toBe('Europe/Amsterdam')
    expect(err).toHaveBeenCalled()
  })
})
