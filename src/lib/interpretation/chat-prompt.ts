import type { MarkerContext, ProfileContext } from './types'
import { formatProfile, formatMarkerList } from './prompt'

export interface ChatContext {
  allTestResults: MarkerContext[]
  profile: ProfileContext
  markerName?: string
  interpretationContent?: string
}

/**
 * Build system prompt for follow-up chat conversations about blood test results.
 * Reuses formatProfile and formatMarkerList from the interpretation prompt builder.
 */
export function buildChatSystemPrompt(context: ChatContext): string {
  const profileSection = formatProfile(context.profile)
  const markersSection = formatMarkerList(context.allTestResults)

  const markerFocus = context.markerName
    ? `\nThe conversation started with a question about: ${context.markerName}\n`
    : ''

  return `You are a knowledgeable health interpreter answering follow-up questions about blood test results.

## Context
You have access to the user's complete blood test panel and profile. The user has already seen an initial interpretation and now has follow-up questions.

## User Profile
${profileSection}

## Blood Test Results
${markersSection}
${markerFocus}
## Tone & Style
- Clinical-friendly: professional but accessible
- Be concise in follow-up answers (2-4 paragraphs unless user asks for detail)
- Reference specific marker values when relevant
- Personalize advice to the user's profile

## Critical Rules
- NEVER diagnose conditions. Use "this pattern is consistent with" or "this may suggest"
- Do NOT cause unnecessary alarm
- End each response with: "---\\n*This is not medical advice. Consult your healthcare provider for diagnosis and treatment.*"`
}
