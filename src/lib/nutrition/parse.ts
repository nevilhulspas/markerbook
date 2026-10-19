
import type { MealType } from '@/lib/database.types'
import {
  nutritionExtractionSchema,
  type NutritionExtraction,
  extractionV2Schema,
  type ExtractionV2,
} from './types'
import { getAnthropic } from '@/lib/ai/client'
import { EXTRACTION_MODEL } from '@/lib/ai/models'
import { stripFences } from '@/lib/ai/json'

/**
 * Cheap model — runs once per logged meal. Sonnet 5.5 runs adaptive thinking
 * by default when the `thinking` field is omitted, so every call site below
 * asks for `between_tools` (no up-front thinking — `disabled` no longer exists
 * on the 5.5 models) at low effort: logging must stay fast. The parsers pick
 * the text block by type, so a thinking block can't break them.
 */
export const NUTRITION_MODEL = EXTRACTION_MODEL

export const SYSTEM_PROMPT = `You are a nutrition parser. Given a food description, return ONLY valid JSON with no other text.

Return this structure:
{
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "fiber_g": number,
  "sugar_g": number,
  "sodium_mg": number,
  "saturated_fat_g": number,
  "food_name": "brief summary of the food",
  "notes": "any additional context mentioned (e.g., 'felt hungry', 'cheat meal', 'post workout') or null if none",
  "date_offset_days": number or null,
  "meal_time": "breakfast" | "lunch" | "dinner" | "snack" | null
}

For date_offset_days: 0 = today, -1 = yesterday, -2 = two days ago, etc. Set to null if no date mentioned.
For meal_time: extract if mentioned (e.g., "at breakfast", "for dinner", "lunch"). Set to null if not mentioned.

Use your knowledge of nutrition databases. If weight is given, calculate accordingly. If weight is not given, assume a typical serving size. Handle mixed Dutch/English input. Only return valid JSON, no other text.`

export const UNDO_KEYWORDS = [
  'undo',
  'revert',
  'delete last',
  'remove last',
  'cancel last',
  'oops',
  'ongedaan',
  'verwijder laatste',
  'wis laatste',
]

export function isUndoCommand(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return UNDO_KEYWORDS.some((k) => lower.includes(k))
}

export function computeEntryDate(
  dateOffsetDays: number | null,
  mealTime: MealType | null,
  now: Date = new Date()
): Date {
  const date = new Date(now)
  if (dateOffsetDays != null && dateOffsetDays !== 0) {
    date.setDate(date.getDate() + dateOffsetDays)
  }
  switch (mealTime) {
    case 'breakfast':
      date.setHours(8, 0, 0, 0)
      break
    case 'lunch':
      date.setHours(12, 30, 0, 0)
      break
    case 'dinner':
      date.setHours(19, 0, 0, 0)
      break
    case 'snack':
      date.setHours(15, 0, 0, 0)
      break
  }
  return date
}

/** Calls Claude to estimate macros for a free-text meal. Throws on bad output. */
export async function parseFoodText(text: string): Promise<NutritionExtraction> {
  const msg = await getAnthropic().messages.create({
    model: NUTRITION_MODEL,
    max_tokens: 400,
    thinking: { type: 'between_tools' },
    output_config: { effort: 'low' },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Food: ${text}` }],
  })
  const block = msg.content.find((b) => b.type === 'text')
  const rawText = block && block.type === 'text' ? block.text : ''
  let json: unknown
  try {
    json = JSON.parse(stripFences(rawText))
  } catch {
    throw new Error('Could not read the nutrition for that meal. Try rephrasing.')
  }
  const parsed = nutritionExtractionSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error('The nutrition estimate was incomplete. Try rephrasing.')
  }
  return parsed.data
}

// ── v2 parser ────────────────────────────────────────────────────────────────

/**
 * Builds the system prompt for the v2 multi-item extractor.
 *
 * @param libraryNames - saved meal/food names from the user's library
 * @param assumeDefaults - when true, suppress clarifying questions
 */
export function buildExtractPrompt(libraryNames: string[], assumeDefaults: boolean): string {
  let prompt = `You parse spoken/typed food descriptions into structured items. Return ONLY valid JSON, no other text.

Schema:
{
  "items": [
    {
      "query": "concise search term for a food-composition database (e.g. 'chicken breast cooked', 'jasmine rice cooked', 'whole milk')",
      "grams": number or null,
      "estimated_calories": number,
      "estimated_protein_g": number,
      "estimated_carbs_g": number,
      "estimated_fat_g": number,
      "estimated_fiber_g": number,
      "estimated_sugar_g": number,
      "estimated_sodium_mg": number,
      "estimated_saturated_fat_g": number
    }
  ],
  "food_name": "brief summary of the whole meal",
  "notes": "context like 'post workout' or 'cheat meal', or null",
  "date_offset_days": number or null,
  "meal_time": "breakfast" | "lunch" | "dinner" | "snack" | null,
  "question": string or null
}

Rules:
- Split a meal into one item per food. "Chicken with rice" => two items. "2x big mac, fries and a cola" => three items (set grams for 2 big macs to the weight of two).
- "query" must be a concise noun phrase that would match an entry in a food-composition database (Dutch NEVO or Open Food Facts). Use English unless it is a typically Dutch food (e.g. 'boerenkoolstamppot', 'hagelslag') — then keep the Dutch name.
- Include cooking state when relevant ("cooked", "raw", "grilled") — databases have both.
- If grams are stated, set them; if not, set grams to a realistic single serving in grams.
- grams must ALWAYS be the TOTAL grams the user actually consumed. Never 0, never per-unit weight.
- When the user counts items ("two eggs", "drie boterhammen", "three slices of bread", "a scoop of protein", "an apple"), multiply by a realistic per-item weight to get the total grams. Use these defaults when the user doesn't specify a size:
  - Medium chicken egg: 50g shelled. "two eggs" => grams: 100
  - Slice of bread: 30g. "three slices" => grams: 90
  - Slice of Dutch toast / boterham: 35g. "twee boterhammen" => grams: 70
  - Scoop of whey protein: 30g
  - Medium apple/orange/pear: 180g
  - Medium banana: 120g
  - Slice of pizza: 100g
  - Egg yolk only: 18g; egg white only: 33g
- Estimated macros are a fallback in case database lookup fails — make them reasonable for the stated/estimated grams.

Extracting meal_time and date_offset_days:
- Listen for explicit meal cues anywhere in the input — "for lunch", "had breakfast", "at dinner", "as a snack", "voor de lunch", "bij het ontbijt", "als tussendoortje" — and set meal_time accordingly.
- date_offset_days: 0 = today, -1 = yesterday ("gisteren"), -2 = two days ago. Only set when the user explicitly references a past day. Otherwise null.
- If no meal cue is mentioned, leave meal_time null.`

  if (libraryNames.length > 0) {
    const nameList = libraryNames.map((n) => `- ${n}`).join('\n')
    prompt += `\n\nSaved meals and foods (do NOT split these into parts; return ONE item whose query is the exact saved name):\n${nameList}`
  }

  if (assumeDefaults) {
    prompt += `\n\nNever ask questions: always assume typical portions. "question" must be null.`
  } else {
    prompt += `\n\nClarifying questions:
- If — and only if — the input is ambiguous in a way that materially changes the macros (e.g. "200g chicken with rice": does 200g cover the rice too?), set "question" to ONE short question in the same language the user used. Still return items with your best assumption.
- Otherwise set "question" to null. Never ask about trivia (exact brand, cooking oil amounts).`
  }

  return prompt
}

/**
 * v2 parser: splits the meal into individual items, supports clarifying
 * questions, and respects the user's saved-meal library.
 */
export async function parseFoodTextV2(
  text: string,
  opts: { libraryNames: string[]; assumeDefaults: boolean }
): Promise<ExtractionV2> {
  const msg = await getAnthropic().messages.create({
    model: NUTRITION_MODEL,
    max_tokens: 1200,
    thinking: { type: 'between_tools' },
    output_config: { effort: 'low' },
    system: buildExtractPrompt(opts.libraryNames, opts.assumeDefaults),
    messages: [{ role: 'user', content: `Food: ${text}` }],
  })
  const block = msg.content.find((b) => b.type === 'text')
  const rawText = block && block.type === 'text' ? block.text : ''
  let json: unknown
  try {
    json = JSON.parse(stripFences(rawText))
  } catch {
    throw new Error('Could not read the nutrition for that meal. Try rephrasing.')
  }
  const parsed = extractionV2Schema.safeParse(json)
  if (!parsed.success) {
    throw new Error('The nutrition estimate was incomplete. Try rephrasing.')
  }
  return parsed.data
}

/**
 * Infers a meal time bucket from the local hour of a Date.
 * Mirrors caltrack's dashboard boundaries: <11 breakfast, <14 lunch,
 * <17 snack, else dinner.
 */
export function bucketMealTime(d: Date): MealType {
  const h = d.getHours()
  if (h < 11) return 'breakfast'
  if (h < 14) return 'lunch'
  if (h < 17) return 'snack'
  return 'dinner'
}

/**
 * Caltrack-compatible save-command detector.
 * Recognises "save this/that/it as <name>", "save as <name>",
 * "save the last meal/entry/recipe as <name>", and the Dutch equivalents.
 *
 * Returns the trimmed meal name, or null if no save command was found.
 */
const SAVE_REGEXES = [
  /^\s*save\s+(?:this|that|it|the\s+last\s+(?:meal|entry|recipe))\s+as\s+(.+?)\s*[.!?]?\s*$/i,
  /^\s*save\s+as\s+(.+?)\s*[.!?]?\s*$/i,
  /^\s*sla\s+(?:dit|deze|de\s+laatste)\s+op\s+als\s+(.+?)\s*[.!?]?\s*$/i,
] as const

export function parseSaveCommand(text: string): string | null {
  for (const re of SAVE_REGEXES) {
    const m = text.match(re)
    if (m?.[1]) return m[1].trim()
  }
  return null
}
