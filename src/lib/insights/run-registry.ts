/**
 * The live insights runs, so the composer's Stop button can actually stop one
 *.
 *
 * The server cannot tell a deliberate Stop from a phone losing signal: both
 * arrive as a cancelled response body, and OTH-40 deliberately made that case
 * harmless — the run carries on so the answer survives a dropped connection.
 * So Stop needs to say so out loud, on a request of its own, and that request
 * needs a way to reach the run it is stopping. This is that way: one
 * `AbortController` per thread, handed to `streamText`.
 *
 * Deliberately in memory. The app runs as a single container, where this is
 * exactly right and costs nothing. Behind several instances a stop could reach
 * an instance that is not running the turn, and the run would then finish on
 * its own — today's behaviour, not a new failure. If the app is ever scaled
 * out, the registry moves to the database (a `cancelled_at` the loop checks).
 */

/** Live runs, keyed by thread. One thread has at most one run at a time. */
const liveRuns = new Map<string, AbortController>()

/**
 * Register a starting run and return its controller. Any run still registered
 * for the thread is dropped from the map but NOT aborted — it is finishing on
 * its own, and cutting it off is the user's call, not ours.
 */
export function beginRun(threadId: string): AbortController {
  const controller = new AbortController()
  liveRuns.set(threadId, controller)
  return controller
}

/**
 * Stop the thread's live run. Returns whether there was one — the caller uses
 * that only for logging, since a stop that arrives after the answer finished
 * is perfectly normal and not an error.
 */
export function stopRun(threadId: string): boolean {
  const controller = liveRuns.get(threadId)
  if (!controller) return false
  liveRuns.delete(threadId)
  controller.abort()
  return true
}

/**
 * Deregister a finished run. Guarded on identity: if a newer run for the same
 * thread has registered in the meantime, the map belongs to it now and this
 * one must leave it alone.
 */
export function endRun(threadId: string, controller: AbortController): void {
  if (liveRuns.get(threadId) === controller) liveRuns.delete(threadId)
}

/** How many runs are live. Exposed for tests and for a health check. */
export function liveRunCount(): number {
  return liveRuns.size
}
