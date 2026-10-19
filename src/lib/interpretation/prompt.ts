import type { InterpretationRequest, MarkerContext, ProfileContext } from './types'

/**
 * Calculate age from date of birth string (YYYY-MM-DD).
 */
function calculateAge(dob: string): number {
  const birth = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--
  }
  return age
}

/**
 * Format profile fields into readable text for the AI prompt.
 * Omits null/undefined fields. AUT-854: also renders the optional medical-
 * history fields (smoking, alcohol, pregnancy, diet, allergies, family
 * history, birth circumstances, conditions list, free-text notes) so the
 * chat model has the full clinical context.
 */
export function formatProfile(profile: ProfileContext): string {
  const parts: string[] = []

  if (profile.dateOfBirth) {
    parts.push(`Age: ${calculateAge(profile.dateOfBirth)} years`)
  }
  if (profile.sex) {
    parts.push(`Sex: ${profile.sex}`)
  }
  if (profile.heightCm != null) {
    parts.push(`Height: ${profile.heightCm} cm`)
  }
  if (profile.weightKg != null) {
    parts.push(`Weight: ${profile.weightKg} kg`)
  }
  if (profile.activityLevel) {
    parts.push(`Activity level: ${profile.activityLevel.replace('_', ' ')}`)
  }

  // AUT-854 medical history block. We render each present field on its own
  // line so the model can scan it; absent fields are silently omitted so the
  // prompt doesn't fill with "unknown" noise.
  if (profile.smokingStatus) {
    parts.push(`Smoking: ${profile.smokingStatus}`)
  }
  if (profile.alcoholDrinksPerWeek != null) {
    parts.push(`Alcohol: ~${profile.alcoholDrinksPerWeek} drinks/week`)
  }
  // 'not_applicable' is a user-side opt-out — it adds no signal beyond what
  // sex already conveys, so omit it from the prompt.
  if (profile.pregnancyStatus && profile.pregnancyStatus !== 'not_applicable') {
    parts.push(`Pregnancy: ${profile.pregnancyStatus.replace('_', ' ')}`)
  }
  if (profile.dietPattern) {
    parts.push(`Diet: ${profile.dietPattern}`)
  }
  if (profile.bornViaCsection != null) {
    parts.push(`Born via C-section: ${profile.bornViaCsection ? 'yes' : 'no'}`)
  }
  if (profile.breastfedAsInfant != null) {
    parts.push(
      `Breastfed as infant: ${profile.breastfedAsInfant ? 'yes' : 'no'}`
    )
  }
  if (profile.knownAllergies && profile.knownAllergies.trim()) {
    parts.push(`Known allergies: ${profile.knownAllergies.trim()}`)
  }
  if (profile.familyHistory && profile.familyHistory.trim()) {
    parts.push(`Family history: ${profile.familyHistory.trim()}`)
  }

  // Medical conditions render as a bulleted sub-list. Ongoing entries
  // (no end_date) are tagged "(ongoing)" so the model treats them as
  // current rather than historical.
  const conditions = profile.medicalConditions ?? []
  if (conditions.length > 0) {
    const lines = conditions.map((c) => {
      const range = (() => {
        if (c.startDate && !c.endDate) return ` (since ${c.startDate}, ongoing)`
        if (c.startDate && c.endDate) return ` (${c.startDate} – ${c.endDate})`
        if (!c.startDate && c.endDate) return ` (resolved ${c.endDate})`
        if (!c.startDate && !c.endDate) return ' (ongoing)'
        return ''
      })()
      const note = c.notes && c.notes.trim() ? ` — ${c.notes.trim()}` : ''
      return `- ${c.name}${range}${note}`
    })
    parts.push(`Medical conditions:\n${lines.join('\n')}`)
  }

  // Free-text "anything else the AI should know" — kept last so it acts like
  // a footer / user-authored addendum to the structured fields above.
  if (profile.extraNotes && profile.extraNotes.trim()) {
    parts.push(`Additional notes from user:\n${profile.extraNotes.trim()}`)
  }

  return parts.length > 0 ? parts.join('\n') : 'No profile information available.'
}

/**
 * Format markers as a readable list grouped by category.
 */
export function formatMarkerList(markers: MarkerContext[]): string {
  const grouped = new Map<string, MarkerContext[]>()

  for (const marker of markers) {
    const category = marker.category || 'Uncategorized'
    const list = grouped.get(category) ?? []
    list.push(marker)
    grouped.set(category, list)
  }

  const lines: string[] = []
  for (const [category, categoryMarkers] of grouped) {
    lines.push(`\n**${category}:**`)
    for (const m of categoryMarkers) {
      const displayName = m.shortName ? `${m.name} (${m.shortName})` : m.name
      const range =
        m.refRangeLow != null && m.refRangeHigh != null
          ? ` (ref: ${m.refRangeLow}-${m.refRangeHigh})`
          : ''
      lines.push(`- ${displayName}: ${m.value} ${m.unit}${range} [${m.status}]`)
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'No other markers available.'
}

const SINGLE_MARKER_SYSTEM = `You are a knowledgeable health interpreter analyzing blood test results.

## Tone & Style
- Clinical-friendly: professional but accessible, like a good doctor explaining things clearly
- Be thorough: cover biological mechanisms, research context, nuanced interpretation
- Never cause unnecessary alarm. Mildly abnormal values are often meaningless in isolation

## Response Structure
Structure your response in exactly four markdown sections with ## headings:

### 1. ## What is {marker_name}?
What it measures and why it matters. 2-3 sentences covering biological role and clinical relevance.

### 2. ## Your Result
Personalized interpretation of the value considering the user's profile:
- Show the user's value vs lab reference range vs tighter optimal range (present both ranges side-by-side so the user understands the difference)
- If value is abnormal: explain possible benign reasons FIRST (dehydration, recent exercise, fasting state, lab variation, supplements, time of day), then note when to genuinely be concerned
- If value is within range: note whether it is in the optimal zone or just within normal limits
- Weave cross-marker connections naturally inline: "Your iron at X combined with your ferritin at Y suggests..."
- Only mention trends if the context includes prior values and the trend is significant

### 3. ## How to Improve
Specific, actionable advice:
- Supplements with specific dosages (e.g., "Vitamin D3, 2000-4000 IU daily with a fatty meal")
- Specific foods (name them, not just food groups)
- Exercise types, sleep habits, lifestyle adjustments
- Personalize to the user's activity level and sex

### 4. ## Related Markers
Which other markers from this test relate to this one and how. 2-3 sentences weaving cross-marker correlations naturally.

## Critical Rules
- NEVER diagnose conditions. Use phrases like "this pattern is consistent with" or "this may suggest" rather than "you have"
- Do NOT cause unnecessary alarm. Mildly abnormal values are often meaningless in isolation
- End with exactly this line: \`---\\n*This is not medical advice. Consult your healthcare provider for diagnosis and treatment.*\``

const FULL_TEST_SYSTEM = `You are a knowledgeable health interpreter providing a holistic blood test summary.

## Tone & Style
- Clinical-friendly: professional but accessible, like a good doctor explaining things clearly
- Be thorough: cover patterns, correlations, and actionable insights
- Never cause unnecessary alarm. Focus on the overall picture

## Response Structure
Structure your response in exactly five markdown sections with ## headings:

### 1. ## Overview
2-3 sentence high-level picture of this test. What does the overall panel suggest about the person's health?

### 2. ## Key Findings
Bullet list of notable results (abnormal values, notable patterns). For each:
- Brief explanation and significance
- Mention benign explanations first for mildly abnormal values
- Note genuinely concerning findings only when warranted

### 3. ## Cross-Marker Patterns
Connections between markers that tell a bigger story (e.g., "Your lipid panel combined with your inflammatory markers suggests..."). Only include genuine correlations -- do not force connections where none exist.

### 4. ## Recommendations
Top 3-5 actionable items prioritized by impact:
- Specific supplements with dosages
- Specific foods (name them)
- Lifestyle changes (exercise types, sleep habits)
- Personalized to the user's profile (age, sex, activity level)

### 5. ## Markers to Watch
Which markers deserve attention at the next test and why. Help the user understand what to track over time.

## Critical Rules
- NEVER diagnose conditions. Use phrases like "this pattern is consistent with" or "this may suggest"
- Do NOT cause unnecessary alarm
- End with exactly this line: \`---\\n*This is not medical advice. Consult your healthcare provider for diagnosis and treatment.*\``

/**
 * Build system and user prompts for single-marker interpretation.
 */
export function buildSingleMarkerPrompt(
  request: InterpretationRequest
): { system: string; user: string } {
  const system = SINGLE_MARKER_SYSTEM.replaceAll('{marker_name}', request.markerName)

  const userParts: string[] = []

  // Primary marker
  userParts.push(`Interpreting: ${request.markerName} = ${request.markerValue} ${request.markerUnit}`)
  userParts.push(`Status: ${request.status ?? 'unknown'}`)

  // Reference range
  if (request.refRangeLow != null && request.refRangeHigh != null) {
    userParts.push(
      `Lab reference range: ${request.refRangeLow} - ${request.refRangeHigh} ${request.markerUnit}`
    )
  } else {
    userParts.push('Lab reference range: No reference range available')
  }

  // Profile
  userParts.push('')
  userParts.push('User profile:')
  userParts.push(formatProfile(request.profile))

  // Cross-marker context
  userParts.push('')
  userParts.push('All markers from this test:')
  userParts.push(formatMarkerList(request.allTestResults))

  return { system, user: userParts.join('\n') }
}

/**
 * Build system and user prompts for full-test holistic interpretation.
 */
export function buildFullTestPrompt(
  request: InterpretationRequest
): { system: string; user: string } {
  const system = FULL_TEST_SYSTEM

  const userParts: string[] = []

  userParts.push('Provide a holistic summary of this blood test panel.')

  // Profile
  userParts.push('')
  userParts.push('User profile:')
  userParts.push(formatProfile(request.profile))

  // All markers
  userParts.push('')
  userParts.push('All markers from this test:')
  userParts.push(formatMarkerList(request.allTestResults))

  return { system, user: userParts.join('\n') }
}
