import type { Supplement } from '@/lib/database.types'
import { appTodayISO } from '@/lib/dates/today'

export type SupplementMode = 'active' | 'upcoming' | 'stopped'

/**
 * Today on the app calendar (APP_TIME_ZONE). The same helper drives the
 * chat's `today()` in stack-tools.ts and the server actions, and this module
 * runs on both server and client, so the active/upcoming boundary agrees
 * everywhere (and between the server render and the browser).
 */
const todayISO = () => appTodayISO()

/**
 * Which Stack tab a supplement belongs to. A future `start_date` with no
 * `end_date` is "upcoming" (planned, not yet active); `start_date` today-or-
 * earlier with no end is "active"; anything with an `end_date` is "stopped".
 * ISO date strings compare lexicographically. Pure — safe on server or client.
 */
export function matchesSupplementMode(s: Supplement, mode: SupplementMode): boolean {
  if (s.end_date) return mode === 'stopped'
  return s.start_date > todayISO() ? mode === 'upcoming' : mode === 'active'
}
