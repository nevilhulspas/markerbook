import { describe, it, expect } from 'vitest'

import { APP_TIME_ZONE, appTodayISO, localDateISO } from '../today'

describe('appTodayISO', () => {
  it('is pinned to the Dutch calendar', () => {
    expect(APP_TIME_ZONE).toBe('Europe/Amsterdam')
  })

  it('gives the Dutch date just after midnight, when UTC is still on yesterday', () => {
    // 00:30 in Amsterdam on 18 Oct (summer time, UTC+2) = 22:30 UTC on 17 Oct.
    expect(appTodayISO(new Date('2026-10-17T22:30:00Z'))).toBe('2026-10-18')
    // 00:30 in Amsterdam on 1 Dec (winter time, UTC+1) = 23:30 UTC on 30 Nov.
    expect(appTodayISO(new Date('2026-11-30T23:30:00Z'))).toBe('2026-12-01')
  })

  it('always formats as zero-padded YYYY-MM-DD', () => {
    expect(appTodayISO(new Date('2026-01-04T12:00:00Z'))).toBe('2026-01-04')
  })

  it('matches the UTC date during the rest of the day', () => {
    expect(appTodayISO(new Date('2026-10-17T12:00:00Z'))).toBe('2026-10-17')
    expect(appTodayISO(new Date('2026-10-17T21:59:00Z'))).toBe('2026-10-17')
  })
})

describe('localDateISO', () => {
  it("formats the runtime's local calendar date with zero padding", () => {
    const d = new Date(2026, 0, 5, 0, 15) // 5 Jan 2026, 00:15 local time
    expect(localDateISO(d)).toBe('2026-01-05')
  })
})
