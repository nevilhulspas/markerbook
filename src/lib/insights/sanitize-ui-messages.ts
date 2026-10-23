// Defensive sanitizer applied to incoming UIMessage[]
// before they're handed to convertToModelMessages.
//
// Anthropic rejects any conversation whose assistant turn contains a
// `tool_use` block without a matching `tool_result` block in the next
// message ("messages.N: `tool_use` ids were found without `tool_result`
// blocks immediately after: …"). That mismatch happens when:
//
//   - The model started a tool call (state: input-streaming →
//     input-available), the stream was interrupted (network drop, timeout,
//     user navigates) before the tool result came back, and
//   - The client retained the half-streamed tool parts in its in-memory
//     chat state and replayed them in the next submit's body.
//
// The persisted side is already safe — only output-available parts get
// saved — but the client doesn't have that filter, so we apply it
// server-side too. Tool parts that didn't reach `output-available` or
// `output-error` are stripped; the surrounding message and any text/other
// parts on it survive untouched, so the conversation order stays intact.
//
// Pure, no I/O — exported separately so the route can stay focused and
// the rule is unit-testable.

import type { UIMessage } from 'ai'

type TPart = {
  type?: string
  state?: string
}

function isToolPart(p: unknown): p is TPart {
  const t = (p as TPart).type
  return typeof t === 'string' && (t === 'dynamic-tool' || t.startsWith('tool-'))
}

function isComplete(p: TPart): boolean {
  // output-available, output-error and output-denied (the user declined an
  // approval card) all produce a tool_result block in the Anthropic
  // conversion — the "input-…" and unanswered approval states are unsafe.
  return p.state === 'output-available' || p.state === 'output-error' || p.state === 'output-denied'
}

export function sanitizeUiMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map((msg, index) => {
    if (msg.role !== 'assistant') return msg
    // An answered approval card (tool-approval.ts) is the reason the LAST
    // message was re-posted: the server runs the approved tool from it. Kept
    // there only — anywhere else it would replay a tool_use with no result.
    const isLast = index === messages.length - 1
    const parts = (msg.parts ?? []) as unknown[]
    const cleaned = parts.filter(
      (p) => !isToolPart(p) || isComplete(p) || (isLast && p.state === 'approval-responded')
    )
    if (cleaned.length === parts.length) return msg
    return { ...msg, parts: cleaned as UIMessage['parts'] }
  })
}
