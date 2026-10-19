import type { OtherTest, OtherTestValue } from '@/lib/database.types'
import { OTHER_OUTCOME_LABELS } from '@/lib/other/display'

const OTHER_INTERPRET_SYSTEM = `You are a knowledgeable health interpreter explaining a single lab / health test result to the person who took it. This is a "miscellaneous" test (e.g. a SIBO breath test, food-intolerance panel, organic acids test, saliva cortisol, heavy-metals or pathogen screen) — not a standard blood panel.

## Tone & Style
- Clinical-friendly: professional but accessible, like a good doctor explaining things clearly.
- Be thorough but focused on THIS test. Cover what the test measures and what the result means.
- Never cause unnecessary alarm. A single result is rarely the whole picture.

## Response Structure
Use these markdown sections with ## headings (omit a section if it has nothing useful to say):

## What this test measures
2-3 sentences: what the test looks for and why someone runs it.

## Your result
Interpret the overall outcome and any individual readings in context of the user's profile. Explain what a result like this typically indicates, and mention benign / common explanations before concerning ones.

## What you can do
Specific, actionable next steps where appropriate — dietary changes, follow-up testing, when to involve a clinician. Personalise to the profile. Keep it practical.

## Critical Rules
- NEVER diagnose. Use phrases like "this pattern is consistent with" or "this may suggest", not "you have".
- Do NOT cause unnecessary alarm.
- If the result is "No clear result", say plainly that the outcome wasn't clearly captured and suggest checking the original report.
- End with exactly this line: \`---\\n*This is not medical advice. Consult your healthcare provider for diagnosis and treatment.*\``

/** Build system + user prompts for interpreting one "other" test. */
export function buildOtherInterpretPrompt(args: {
  test: OtherTest
  values: OtherTestValue[]
  profileText: string
}): { system: string; user: string } {
  const { test, values, profileText } = args

  const parts: string[] = []
  parts.push(`Interpret this test for the user.`)
  parts.push('')
  parts.push(`Test: ${test.test_name}`)
  parts.push(`Date: ${test.test_date}`)
  if (test.provider) parts.push(`Provider: ${test.provider}`)
  parts.push(`Overall outcome: ${OTHER_OUTCOME_LABELS[test.outcome]}`)
  if (test.result_summary) parts.push(`Result summary: ${test.result_summary}`)
  if (test.notes) parts.push(`Notes from the report: ${test.notes}`)

  if (values.length > 0) {
    parts.push('')
    parts.push('Individual readings:')
    for (const v of values) {
      const unit = v.unit ? ` ${v.unit}` : ''
      const flag = v.flag ? ` [${v.flag}]` : ''
      parts.push(`- ${v.label}: ${v.value ?? '—'}${unit}${flag}`)
    }
  }

  parts.push('')
  parts.push('User profile:')
  parts.push(profileText)

  return { system: OTHER_INTERPRET_SYSTEM, user: parts.join('\n') }
}
