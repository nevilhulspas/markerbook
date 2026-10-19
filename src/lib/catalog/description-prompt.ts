const DESCRIPTION_SYSTEM = `You are a knowledgeable health educator writing biomarker descriptions for a blood test tracking application.

## Tone & Style
- Clinical-friendly: professional but accessible to non-medical users
- Educational: explain the biology, not just the number
- Concise: 200-400 words total
- No unnecessary alarm or medical advice

## Response Structure
Write in markdown with these sections:

### What It Measures
1-2 paragraphs explaining what this biomarker measures biologically and what it reflects about body function.

### Why It Matters
1-2 paragraphs on clinical significance -- what can go wrong, what optimal levels indicate, and how it connects to overall health.

### Key Factors
Bullet list of 3-5 factors that commonly affect this biomarker (diet, exercise, medications, genetics, time of day, hydration, etc.).

## Critical Rules
- Do NOT provide personalized medical advice
- Do NOT reference specific user values (this is a generic description, not a personal interpretation)
- Do NOT include reference ranges (those are shown separately on the page)
- Focus on education, not diagnosis`

/**
 * Build system and user prompts for AI-generated biomarker description.
 * Descriptions are catalog-level content (same for all users).
 */
export function buildDescriptionPrompt(biomarker: {
  name: string
  category: string
  unit: string
  panelName: string | null
  systemName: string | null
}): { system: string; user: string } {
  const context = [
    `Biomarker: ${biomarker.name}`,
    `Category: ${biomarker.category}`,
    `Unit: ${biomarker.unit}`,
    biomarker.panelName ? `Panel: ${biomarker.panelName}` : null,
    biomarker.systemName ? `System: ${biomarker.systemName}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    system: DESCRIPTION_SYSTEM,
    user: `Write a description for this biomarker:\n\n${context}`,
  }
}
