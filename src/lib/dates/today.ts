/**
 * "Today" as a YYYY-MM-DD calendar date.
 *
 * `new Date().toISOString().slice(0, 10)` is the UTC date, which in the
 * Netherlands is still yesterday between 00:00 and 01:00 (winter) / 02:00
 * (summer). Use one of these instead.
 */

/**
 * The calendar the app's dates follow. The server runs in UTC and has no
 * per-user time zone, so one installation uses one zone:
 * NEXT_PUBLIC_APP_TIME_ZONE (an IANA name such as "Europe/Berlin"), default
 * Europe/Amsterdam. It is inlined at build time, so server and browser agree.
 * An unknown name falls back to the default instead of crashing every page.
 */
export const APP_TIME_ZONE = resolveTimeZone(process.env.NEXT_PUBLIC_APP_TIME_ZONE)

function resolveTimeZone(configured: string | undefined): string {
  const fallback = 'Europe/Amsterdam'
  if (!configured) return fallback
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: configured })
    return configured
  } catch {
    console.error(`NEXT_PUBLIC_APP_TIME_ZONE "${configured}" is not a valid time zone; using ${fallback}.`)
    return fallback
  }
}

const appDateParts = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Today on the app's calendar (`APP_TIME_ZONE`), identical on server and
 * client. Use it for anything rendered on the server (including the initial
 * value of a client component, which is server-rendered first) and for any
 * stored date that other writers must agree with (the supplement active /
 * upcoming split, a body-log `logged_on` the chat may also write).
 */
export function appTodayISO(now: Date = new Date()): string {
  // Built from parts, not a locale's date pattern, so the output never depends
  // on the runtime's CLDR data.
  const part = (type: 'year' | 'month' | 'day') =>
    appDateParts.formatToParts(now).find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

/**
 * Today on the device's own calendar. Only for values computed in the browser
 * after an interaction, never during render — e.g. an export file name.
 */
export function localDateISO(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const appClockParts = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** The wall-clock parts of an instant on the app's calendar. */
function appParts(d: Date): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(appClockParts.formatToParts(d).find((p) => p.type === type)?.value ?? 0)
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour') % 24, mi: get('minute'), s: get('second') }
}

/** The hour (0–23) of an instant on the app's clock, not the server's (UTC). */
export function appHour(d: Date): number {
  return appParts(d).h
}

/** The minute (0–59) of an instant on the app's clock. */
export function appMinute(d: Date): number {
  return appParts(d).mi
}

/** Minutes the app's zone is ahead of UTC at instant `d`. */
function appOffsetMinutes(d: Date): number {
  const p = appParts(d)
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s)
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000)
}

/**
 * The instant at wall-clock `hour:minute` on `dateISO` (YYYY-MM-DD) in the
 * app's zone. Daylight-saving changes are handled by checking the offset at
 * the result.
 */
export function appWallTime(dateISO: string, hour: number, minute = 0): Date {
  const [y, m, d] = dateISO.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, hour, minute)
  const first = guess - appOffsetMinutes(new Date(guess)) * 60000
  return new Date(guess - appOffsetMinutes(new Date(first)) * 60000)
}

/** `dateISO` (YYYY-MM-DD) plus `days` calendar days. */
export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}
