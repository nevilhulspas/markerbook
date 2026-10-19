/**
 * Recovering an answer whose stream died before it reached the screen (OTH-40).
 *
 * The chat answer arrives over one long-lived HTTP response. Mobile browsers
 * do not keep those alive: lock the phone, switch apps, or move between Wi-Fi
 * and cellular and the response is torn down mid-answer. The fetch rejects
 * with a `TypeError` ("Load failed" on WebKit, "Failed to fetch" on Chrome),
 * which the chat used to show as a raw error with the reply half-written and
 * no way back.
 *
 * The answer itself is not lost: the route keeps generating after the client
 * goes away (`consumeSseStream`) and writes the finished reply to
 * `chat_messages`. So recovery is just "wait for the row, then show it".
 *
 * Pure predicates only — the polling loop lives in insights-client.tsx.
 */

/** How long to wait between checks for the finished reply. */
export const RECOVERY_POLL_INTERVAL_MS = 3_000

/**
 * How long after the question we keep waiting for its answer. This one rule
 * decides both whether to start waiting and whether to keep waiting, so a wait
 * can never outlive the turn it belongs to.
 *
 * Generous, because a long insights turn is genuinely slow: up to eight steps,
 * web searches, and extended thinking. Past it the turn is gone (a server
 * restart, a failed run) and reopening the thread should show it as it is.
 */
export const RECOVERY_ANSWER_WINDOW_MS = 6 * 60_000

/**
 * All a waiting client needs to know about a thread: what the newest stored
 * message is, and how many are stored.
 *
 * Deliberately tiny. The wait asks this question every few seconds, so it is
 * answered by one narrow query (`getThreadTail`) rather than by reloading the
 * whole transcript and re-signing every attachment link.
 */
export type ThreadTail = {
  /** Role of the newest stored message; null for an empty thread. */
  lastRole: 'user' | 'assistant' | null
  /** When that message was stored (ISO 8601); null for an empty thread. */
  lastStoredAt: string | null
  /** How many messages the thread holds. */
  total: number
}

/**
 * The same shape, read off a transcript that is already in hand — so opening a
 * thread does not pay for a second query to answer a question its own load
 * already answered.
 */
export function threadTailOf(rows: Array<{ role: string; created_at: string }>): ThreadTail {
  const newest = rows[rows.length - 1]
  return {
    lastRole:
      newest?.role === 'user' || newest?.role === 'assistant' ? newest.role : null,
    lastStoredAt: newest?.created_at ?? null,
    total: rows.length,
  }
}

/**
 * True when the thread's newest stored message is the user's — the assistant
 * still owes an answer. The route stores the user's message when the request
 * arrives and the assistant's only once the run is over, so this is exactly
 * "the reply has not landed yet".
 */
export function answerIsOutstanding(tail: ThreadTail): boolean {
  return tail.lastRole === 'user'
}

/**
 * True when the stored transcript is safe to put on screen in place of what
 * the chat is showing.
 *
 * Two conditions, and the second one is the load-bearing one. The transcript
 * must end with the assistant's reply — and it must account for every message
 * already on screen. A shorter transcript means the client is holding
 * something the server never saw: a question added optimistically whose
 * request never arrived (the phone was offline). Swapping that transcript in
 * would delete the user's own message in front of them.
 */
export function answerIsRecoverable(tail: ThreadTail, messagesOnScreen: number): boolean {
  if (tail.lastRole !== 'assistant') return false
  return tail.total >= messagesOnScreen
}

/**
 * True when an outstanding answer is recent enough that the server is likely
 * still writing it — the condition for starting, and for continuing, a wait.
 *
 * `now` is the browser's clock and `lastStoredAt` is the database's, so the
 * gap between them is not purely elapsed time. A device running fast would
 * otherwise make every answer look too old to wait for, switching recovery off
 * on that phone entirely; a slow one would stretch the wait by the skew. Ages
 * are clamped at zero, which turns a fast clock into "just asked" — waiting a
 * little too long is recoverable, never waiting at all is not.
 */
export function answerMayStillArrive(tail: ThreadTail, now: number): boolean {
  if (tail.lastRole !== 'user' || tail.lastStoredAt === null) return false
  const askedAt = Date.parse(tail.lastStoredAt)
  if (!Number.isFinite(askedAt)) return false
  return Math.max(0, now - askedAt) < RECOVERY_ANSWER_WINDOW_MS
}

/**
 * True when the failure means the CONNECTION dropped rather than the server
 * reporting a problem.
 *
 * `fetch` rejects with a `TypeError` when the request or the response body
 * fails at the network layer — the mobile case above. Everything else the chat
 * surfaces is an `Error` the server described (a non-2xx body, or an error
 * chunk inside the stream); no reply is coming for those, so waiting would
 * only hide a message the user needs to read.
 *
 * Deliberately broader than the AI SDK's own test, which additionally requires
 * "fetch" or "network" in the message: WebKit says plain "Load failed", so
 * that test misses the very iOS case this exists for. The cost of the breadth
 * is that a stray `TypeError` from our own code also lands here — which is why
 * `describesConnectionFailure` below, used to REPLACE the message on screen,
 * is the narrow one. Starting a wait on a false positive costs one query;
 * hiding a real bug's message costs a debugging session.
 */
export function isConnectionFailure(error: unknown): boolean {
  return error instanceof TypeError
}

/** Wordings browsers use when a request or its response body dies mid-flight. */
const CONNECTION_FAILURE_MESSAGES =
  /load failed|failed to fetch|network|connection (was )?(lost|closed|reset)|networkerror/i

/**
 * True when the failure is recognisably a dropped connection, message and all.
 *
 * Used only to decide whether to replace the browser's wording with our own.
 * An unrecognised `TypeError` keeps its message, so a genuine bug in our code
 * still says what went wrong.
 */
export function describesConnectionFailure(error: unknown): boolean {
  return isConnectionFailure(error) && CONNECTION_FAILURE_MESSAGES.test((error as TypeError).message)
}
