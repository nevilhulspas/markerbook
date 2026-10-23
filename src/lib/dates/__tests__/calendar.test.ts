import { describe, it, expect } from 'vitest'
import { formatCalendarDate } from '../calendar'

describe('formatCalendarDate (regression: date-only strings parsed as UTC)', () => {
  it('keeps the calendar day of a date-only string', () => {
    // en-GB: day first.
    expect(formatCalendarDate('2026-05-01', { day: '2-digit', month: '2-digit', year: 'numeric' })).toBe('01/05/2026')
    expect(formatCalendarDate('2026-05-01')).toBe('1 May 2026')
  })
})
