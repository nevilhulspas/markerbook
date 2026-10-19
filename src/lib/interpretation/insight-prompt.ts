import { formatProfile } from '@/lib/interpretation/prompt'
import type { ProfileContext } from '@/lib/interpretation/types'

const INSIGHT_SYSTEM = `You are a knowledgeable health interpreter providing a personalized biomarker insight.

## Context
You are analyzing a specific biomarker from the user's blood test history. Unlike a single-test interpretation, you have access to the user's FULL HISTORY for this biomarker across all their tests.

## Tone & Style
- Clinical-friendly: professional but accessible
- Personalized: reference the user's actual values, trends, and profile
- Concise: 150-300 words total
- Focus on what this marker means FOR THIS USER specifically

## Response Structure
Write a cohesive 2-3 paragraph insight (no section headings needed):

Paragraph 1: Current status -- what their latest value means in context of the reference range and their profile (age, sex, activity level).

Paragraph 2: Trend analysis (if multiple values) -- how this marker has changed over time, whether the trend is concerning or encouraging, and what might explain the changes.

Paragraph 3 (if applicable): One specific, actionable suggestion personalized to their profile and current value.

## Critical Rules
- NEVER diagnose conditions. Use "this pattern is consistent with" or "this may suggest"
- Do NOT cause unnecessary alarm for mildly abnormal values
- If only one data point exists, skip trend analysis and focus on current status
- End with: \`---\\n*This is not medical advice. Consult your healthcare provider for diagnosis and treatment.*\``

/**
 * Build system and user prompts for personalized biomarker contextual insight.
 * Insights are user-specific, considering their values, profile, and trends.
 */
export function buildInsightPrompt(request: {
  biomarkerName: string
  unit: string
  values: Array<{ date: string; value: number; unit?: string; testName: string }>
  refRangeLow: number | null
  refRangeHigh: number | null
  profile: ProfileContext
}): { system: string; user: string } {
  const userParts: string[] = []

  userParts.push(`Biomarker: ${request.biomarkerName} (${request.unit})`)

  if (request.refRangeLow != null && request.refRangeHigh != null) {
    userParts.push(
      `Reference range: ${request.refRangeLow} - ${request.refRangeHigh} ${request.unit}`
    )
  }

  userParts.push('')
  userParts.push('User profile:')
  userParts.push(formatProfile(request.profile))

  userParts.push('')
  userParts.push(`Historical values (${request.values.length} data points):`)
  for (const v of request.values) {
    userParts.push(`- ${v.date}: ${v.value} ${v.unit ?? request.unit} (${v.testName})`)
  }

  return { system: INSIGHT_SYSTEM, user: userParts.join('\n') }
}
