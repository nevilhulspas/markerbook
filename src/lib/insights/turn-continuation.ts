/**
 * Detecting — and resuming — an insights-chat turn that was cut short.
 *
 * Anthropic pauses a long-running server-tool turn (`web_search`) and returns
 * `stop_reason: "pause_turn"`, expecting the caller to send the response back
 * so the turn can carry on. `@ai-sdk/anthropic` maps that to the UNIFIED finish
 * reason `'stop'` — indistinguishable from a genuinely finished turn — and
 * `streamText`'s loop only keeps stepping while CLIENT-side tool calls are
 * outstanding. A paused turn therefore ends the run with no text, no error and
 * nothing in the server log: the user is left staring at "Tool activity" and a
 * Sources row that never grows an answer.
 *
 * The provider's own stop reason does survive, as `rawFinishReason`, so we can
 * both log it and act on it here.
 *
 * NOTE: this is a DIFFERENT cause of the same symptom than OTH-36, which was
 * the 4096-token output cap. That fix is still needed; it just doesn't cover
 * this case.
 */

/**
 * How many times a single turn may be resumed. Two is enough for the observed
 * pause-then-finish pattern while bounding the cost of a pathological loop.
 */
export const MAX_TURN_CONTINUATIONS = 2

/** Anthropic's stop reason for "this turn is paused, send it back to continue". */
export const PAUSE_TURN = 'pause_turn'

export type TurnEnd = {
  /** Unified finish reason from the AI SDK (last step). */
  finishReason: string
  /** The provider's own stop reason. `pause_turn` only ever appears here. */
  rawFinishReason?: string
  /** True when the run emitted at least one non-empty text part. */
  hasText: boolean
  /** True when the run made at least one tool call. */
  hasToolCalls: boolean
  /**
   * True when the LAST step made a tool call that no result came back for —
   * i.e. the run stopped to wait for the CLIENT to answer (`ask_user`,
   * `confirm_health_document_index`: tools with no server `execute`).
   *
   * Server-executed and provider-executed tools (including `web_search`) both
   * produce their result inside the same step, so this is false for them.
   */
  awaitsToolResults?: boolean
  /** True when the HTTP stream was aborted (client navigated away, or dropped). */
  isAborted?: boolean
}

/**
 * Whether a finished `streamText` run should be resumed rather than persisted.
 *
 * Deliberately narrow: resuming a turn that really was complete would append a
 * second, regenerated answer to the same bubble — the OTH-18 failure mode.
 */
export function shouldContinueTurn(
  end: TurnEnd,
  continuationsSoFar: number,
): boolean {
  if (continuationsSoFar >= MAX_TURN_CONTINUATIONS) return false

  // The turn is WAITING for the user, not cut short. A run that ends
  // on `confirm_health_document_index` / `ask_user` has an unanswered
  // `tool_use` block, and resuming replays the conversation to Anthropic in
  // exactly the shape it rejects: "Tool result is missing for tool call
  // toolu_…". The user then sees that error under the card they were asked to
  // click. The client resumes this turn itself once the card is answered
  // (`lastAssistantMessageAwaitsInteractiveTool`), so the server must not.
  if (end.awaitsToolResults) return false

  // The client is gone. Nobody is waiting for the rest of the answer, and the
  // merged stream is already torn down.
  if (end.isAborted) return false

  // A hard failure or a refusal will not resolve itself on a retry; resuming
  // would just spend another Opus call to reach the same place.
  if (end.finishReason === 'error' || end.finishReason === 'content-filter') {
    return false
  }

  // 1. The provider said outright that the turn is paused, not finished.
  if (end.rawFinishReason === PAUSE_TURN) return true

  // 2. Silent truncation: the model did work but never wrote a word. The tool
  //    calls matter — an empty reply with no tool calls is the model's own
  //    choice, and resending that would spin.
  if (!end.hasText && end.hasToolCalls) return true

  // 3. The step cap (`stopWhen`) ended the run while the model was still
  //    working: the last step made tool calls, their results came back (the
  //    client-tool case returned above), and the model never got the step to
  //    read them. That turn may already hold a progress note ("I'll log your
  //    weights first…"), so check 2 misses it and the user is left with tool
  //    chips and no answer. The SDK only finishes on `tool-calls`
  //    here; a turn the model finished itself ends on `stop`.
  if (end.finishReason === 'tool-calls') return true

  return false
}
