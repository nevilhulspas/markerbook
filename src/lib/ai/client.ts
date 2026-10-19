import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

/**
 * The shared Anthropic client, created on first use. Lazy so importing a
 * module that calls Claude does not need ANTHROPIC_API_KEY until it actually
 * makes a request.
 */
export function getAnthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  return client
}
