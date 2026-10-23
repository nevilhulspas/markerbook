import {
  AI_BUSY_MESSAGE,
  AI_FAILED_MESSAGE,
  AI_KEY_REJECTED_MESSAGE,
  AI_NOT_CONFIGURED_MESSAGE,
} from './messages'

/**
 * True when this server can call Claude. Every AI route and action checks it
 * before the SDK, and pages pass it to client components so AI buttons can be
 * switched off. Call it on the server only: in the browser the key is not
 * visible, so it is always false there.
 */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

/** The response for API routes when AI is not set up. Plain text, like the routes' other early errors. */
export function aiNotConfiguredResponse(): Response {
  return new Response(AI_NOT_CONFIGURED_MESSAGE, { status: 503 })
}

/** HTTP status of an Anthropic SDK error (`status`) or AI SDK error (`statusCode`). */
function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown }
  if (typeof status === 'number') return status
  if (typeof statusCode === 'number') return statusCode
  return undefined
}

/**
 * A plain sentence for a failed AI request. Errors this app throws itself
 * (plain `Error`s, such as "this report is too long") already speak to the
 * user and pass through; SDK, network and parse errors become a short
 * sentence. Does not log; see aiFailureMessage.
 */
export function describeAiError(error: unknown): string {
  if (!isAiConfigured()) return AI_NOT_CONFIGURED_MESSAGE
  const status = statusOf(error)
  if (status === 401 || status === 403) return AI_KEY_REJECTED_MESSAGE
  if (status === 429 || status === 503 || status === 529) return AI_BUSY_MESSAGE
  if (error instanceof Error && error.constructor === Error && error.message.trim()) {
    return error.message
  }
  return AI_FAILED_MESSAGE
}

/** Log the raw error with its context, then return describeAiError's plain sentence. */
export function aiFailureMessage(context: string, error: unknown): string {
  console.error(`[${context}] AI request failed:`, error)
  return describeAiError(error)
}
