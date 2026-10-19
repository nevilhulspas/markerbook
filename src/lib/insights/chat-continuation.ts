import { isToolUIPart, getToolName, type UIMessage } from 'ai'

/**
 * Tools the chat renders with a CUSTOM UI (cards, prompts) instead of the
 * collapsed activity chip. Note this is a RENDERING concept — it includes
 * `build_lab_test_lists`, which executes server-side (it has an `execute` and
 * returns its download cards through the stream).
 */
export const INTERACTIVE_TOOLS = [
  'ask_user',
  'build_lab_test_lists',
  'confirm_health_document_index',
]

/**
 * The strict subset of tools whose results are provided CLIENT-side: they have
 * NO server `execute`; the UI collects the user's answer and calls
 * addToolOutput, after which the run must be resumed with a new request.
 * ONLY these may trigger the auto-continuation below — a server-executed tool
 * (including `build_lab_test_lists`) ending a step means the run was cut
 * short, and resending would regenerate the reply.
 */
export const CLIENT_ANSWERED_TOOLS = ['ask_user', 'confirm_health_document_index']

/**
 * `sendAutomaticallyWhen` predicate for the insights chat (OTH-18).
 *
 * The stock `lastAssistantMessageIsCompleteWithToolCalls` fires whenever the
 * last assistant message ends with ANY completed client-visible tool calls.
 * Server-executed tools complete inside the stream, so a turn that ends right
 * after a server tool step (step-cap hit, or the stream aborted between steps)
 * also matched — the client then re-posted the conversation, and the model
 * REGENERATED its reply instead of resuming (worst with reasoning enabled,
 * whose continuations re-litigate rather than continue). Users saw the same
 * reply streamed 2–3× as separate bubbles.
 *
 * This predicate fires ONLY for the flow the auto-resume exists for: the last
 * step ended awaiting interactive tool results (ask_user, …) and the client
 * has since filled ALL of them in. Server-tool endings never auto-resend.
 */
export function lastAssistantMessageAwaitsInteractiveTool({
  messages,
}: {
  messages: UIMessage[]
}): boolean {
  const message = messages[messages.length - 1]
  if (!message || message.role !== 'assistant') return false

  // Only consider the LAST step of the message (mirrors the stock predicate).
  const lastStepStartIndex = message.parts.reduce(
    (lastIndex, part, index) => (part.type === 'step-start' ? index : lastIndex),
    -1,
  )
  const lastStepToolParts = message.parts
    .slice(lastStepStartIndex + 1)
    .filter(isToolUIPart)
    .filter((part) => !part.providerExecuted)

  if (lastStepToolParts.length === 0) return false

  // Every tool in the final step must have a result (nothing still streaming)…
  const allComplete = lastStepToolParts.every(
    (part) => part.state === 'output-available' || part.state === 'output-error',
  )
  // …and at least one of them must be a client-answered tool whose result the
  // client just supplied. A step ending purely in server-executed tools means
  // the run was cut short (cap/abort) — resending would regenerate, not resume.
  const hasClientAnswered = lastStepToolParts.some((part) =>
    CLIENT_ANSWERED_TOOLS.includes(getToolName(part)),
  )
  return allComplete && hasClientAnswered
}

/**
 * Is a card on screen still waiting for the user's click?
 *
 * `ask_user` and the document card are answered in the UI: their tool part
 * sits unresolved until the user picks, and that click is the ONLY thing that
 * resumes the run. They are also never persisted in that state, so anything
 * rebuilt from the database is missing them — which makes this the guard
 * before replacing a transcript with a stored copy. Do that while a card is
 * open and the user loses the buttons, and with them any way to continue.
 */
export function hasUnansweredInteractiveTool(messages: UIMessage[]): boolean {
  const message = messages[messages.length - 1]
  if (!message || message.role !== 'assistant') return false
  return message.parts
    .filter(isToolUIPart)
    .some(
      (part) =>
        CLIENT_ANSWERED_TOOLS.includes(getToolName(part)) &&
        part.state !== 'output-available' &&
        part.state !== 'output-error',
    )
}
