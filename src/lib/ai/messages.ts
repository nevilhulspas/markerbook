// Plain sentences for AI problems, shown on screen. Client-safe: pages pass
// the "is AI set up" flag down, and client components show these words.

/** No ANTHROPIC_API_KEY on the server. */
export const AI_NOT_CONFIGURED_MESSAGE =
  'AI features are not set up on this server. Ask the admin to add an Anthropic API key.'

/** The key is there but Anthropic refused it. */
export const AI_KEY_REJECTED_MESSAGE =
  'The Anthropic API key on this server was not accepted. Ask the admin to check it.'

/** Anthropic is rate limiting or overloaded. */
export const AI_BUSY_MESSAGE = 'The AI service is busy right now. Please try again in a minute.'

/** Any other failure of an AI request. */
export const AI_FAILED_MESSAGE = 'The AI could not finish this request. Please try again.'

/** True when a server error message says AI is not set up (so the UI shows a note, not an error). */
export function isAiNotConfiguredMessage(message: string | null | undefined): boolean {
  return message?.trim() === AI_NOT_CONFIGURED_MESSAGE
}
