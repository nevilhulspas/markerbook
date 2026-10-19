// The Claude models this app uses, by job. Change a model here, not at call
// sites. Pure constants, so client components may import this too.

/** Interpretations, insights chat, catalogue descriptions. */
export const REASONING_MODEL = 'claude-opus-5-5'

/** Reading uploaded reports and photos into structured data. */
export const EXTRACTION_MODEL = 'claude-sonnet-5-5'

/** Small classification / translation / matching jobs. */
export const FAST_MODEL = 'claude-haiku-5-5'

/**
 * Thinking setting for every FAST_MODEL call. Haiku 5.5 thinks by default and
 * thinking counts toward max_tokens; these are short, fixed-format jobs (a
 * one-number rerank answer has max_tokens 10), so they run without it, as on
 * Haiku 4.5.
 */
export const FAST_THINKING = { type: 'disabled' } as const
