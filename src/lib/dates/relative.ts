import { APP_LOCALE } from '@/lib/locale'
import { APP_TIME_ZONE, appTodayISO } from './today'

const DAY_MS = 86_400_000

const shortDate = new Intl.DateTimeFormat(APP_LOCALE, {
  month: 'short',
  day: 'numeric',
  timeZone: APP_TIME_ZONE,
})

/** Whole calendar days between two instants, on the `APP_TIME_ZONE` calendar. */
function appCalendarDaysBetween(from: Date, to: Date): number {
  const fromDay = Date.parse(`${appTodayISO(from)}T00:00:00Z`)
  const toDay = Date.parse(`${appTodayISO(to)}T00:00:00Z`)
  return Math.round((toDay - fromDay) / DAY_MS)
}

/**
 * "Today" / "Yesterday" / "3d ago", then a short date ("22 Jul") for anything a
 * week or older — all on the `APP_TIME_ZONE` calendar.
 *
 * Pinned because these labels are rendered on the server (UTC) and hydrated in
 * the browser (the device's zone): an unpinned format put a timestamp late in
 * the UTC evening on different days on the two sides — a React hydration
 * mismatch (#418) on every /insights load.
 *
 * A timestamp slightly ahead of `now` (database vs. device clock skew) counts
 * as today rather than "-1d ago".
 */
export function formatRelativeDate(dateStr: string, now: Date = new Date()): string {
  const date = new Date(dateStr)
  const diffDays = appCalendarDaysBetween(date, now)
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return shortDate.format(date)
}
