import { APP_LOCALE } from '@/lib/locale'
import { APP_TIME_ZONE } from './today'

/**
 * Format a stored date for display. A date-only string ('2026-05-01', a
 * `test_date`) is a calendar day, not an instant: `new Date('2026-05-01')` is
 * UTC midnight, which shows as 30 April in any zone west of UTC. It is
 * formatted in UTC so the day never moves. A full timestamp is shown on the
 * app's calendar.
 */
export function formatCalendarDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnly) {
    const [, y, m, d] = dateOnly
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12)).toLocaleDateString(APP_LOCALE, {
      ...options,
      timeZone: 'UTC',
    })
  }
  return new Date(value).toLocaleDateString(APP_LOCALE, { ...options, timeZone: APP_TIME_ZONE })
}
