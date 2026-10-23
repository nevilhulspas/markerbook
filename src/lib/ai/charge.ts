import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Per-call AI accounting for long background flows (a lab scrape a user's
 * submission started). Such a flow makes many model calls deep inside library
 * code; rather than thread a user id through every helper, the flow runs inside
 * `runChargingAiCalls(userId, …)` and each helper calls `chargeAiCall()` right
 * before its model call. Outside such a run (an admin scrape) it is a no-op.
 */
const chargedUser = new AsyncLocalStorage<string>()

export function runChargingAiCalls<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return chargedUser.run(userId, fn)
}

/** Takes one AI request from the running flow's user; throws over the limit. */
export async function chargeAiCall(): Promise<void> {
  const userId = chargedUser.getStore()
  if (!userId) return
  // Loaded lazily: quota is server-only and most callers never get here.
  const { takeAiRequest } = await import('./quota')
  const quota = await takeAiRequest(userId)
  if (!quota.ok) throw new Error(quota.error)
}
