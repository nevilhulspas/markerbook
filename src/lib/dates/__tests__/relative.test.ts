import { describe, it, expect } from 'vitest'

import { formatRelativeDate } from '../relative'

const NOW = new Date('2026-10-18T16:00:00Z')

describe('formatRelativeDate', () => {
  it('labels the last week relative to now', () => {
    expect(formatRelativeDate('2026-10-18T09:00:00Z', NOW)).toBe('Today')
    expect(formatRelativeDate('2026-10-17T09:00:00Z', NOW)).toBe('Yesterday')
    expect(formatRelativeDate('2026-10-15T09:00:00Z', NOW)).toBe('3d ago')
  })

  it('shows a short date from a week on', () => {
    expect(formatRelativeDate('2026-10-12T12:00:00Z', NOW)).toBe('6d ago')
    expect(formatRelativeDate('2026-10-11T12:00:00Z', NOW)).toBe('11 Oct')
  })

  it('counts Dutch calendar days, not elapsed 24h periods', () => {
    // 23:30 on 17 Oct in Amsterdam, viewed at 08:00 on 18 Oct: under 24h ago,
    // but yesterday on the calendar.
    expect(
      formatRelativeDate('2026-10-17T21:30:00Z', new Date('2026-10-18T06:00:00Z'))
    ).toBe('Yesterday')
    // 00:30 on 18 Oct in Amsterdam is still today at 23:00 the same day.
    expect(
      formatRelativeDate('2026-10-17T22:30:00Z', new Date('2026-10-18T21:00:00Z'))
    ).toBe('Today')
  })

  it('treats a timestamp slightly ahead of now (clock skew) as today', () => {
    expect(formatRelativeDate('2026-10-18T16:00:02Z', NOW)).toBe('Today')
  })

  it('puts a late-evening UTC timestamp on the Dutch calendar day (OTH-85)', () => {
    // 21:24 UTC on 22 Jul = 23:24 in Amsterdam (same day) but 00:24 on 23 Jul
    // in Sofia. The server (UTC) and a Sofia browser must render the same text.
    expect(formatRelativeDate('2026-07-22T21:24:49.998+00:00', NOW)).toBe('22 Jul')
    // 22:30 UTC on 17 Feb = 23:30 in Amsterdam (winter time, UTC+1).
    expect(formatRelativeDate('2026-02-17T22:30:00Z', NOW)).toBe('17 Feb')
    // 23:30 UTC on 17 Feb = 00:30 on 18 Feb in Amsterdam.
    expect(formatRelativeDate('2026-02-17T23:30:00Z', NOW)).toBe('18 Feb')
  })
})
