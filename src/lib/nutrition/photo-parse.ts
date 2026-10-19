import type Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

import { MEAL_TYPES } from '@/lib/database.types'
import { toFileContentBlocks } from '@/lib/health-documents/file-content'
import type { MediaType } from '@/lib/health-documents/media-type'
import { getAnthropic } from '@/lib/ai/client'
import { EXTRACTION_MODEL } from '@/lib/ai/models'
import { stripFences } from '@/lib/ai/json'

/**
 * Vision model — runs once (or twice, if clarified) per photo. Sonnet 5.5 runs
 * adaptive thinking by default when `thinking` is omitted, so the call below
 * asks for `between_tools` (no up-front thinking — `disabled` no longer exists
 * on the 5.5 models) at low effort: scanning must stay fast. The parser picks
 * the text block by type, so a thinking block can't break it.
 */
export const PHOTO_MODEL = EXTRACTION_MODEL

const nullableNumber = z.union([z.number(), z.null()]).optional().transform((v) => v ?? null)
const nullableString = z.union([z.string(), z.null()]).optional().transform((v) => v ?? null)

export const photoItemSchema = z.object({
  query: z.string().min(1),
  grams: nullableNumber,
  estimated_calories: nullableNumber,
  estimated_protein_g: nullableNumber,
  estimated_carbs_g: nullableNumber,
  estimated_fat_g: nullableNumber,
  estimated_fiber_g: nullableNumber,
  estimated_sugar_g: nullableNumber,
  estimated_sodium_mg: nullableNumber,
  estimated_saturated_fat_g: nullableNumber,
})
export type PhotoItem = z.infer<typeof photoItemSchema>

export const photoExtractionSchema = z.object({
  items: z.array(photoItemSchema), // empty allowed when is_food=false or a question is asked
  food_name: z.string().min(1),
  notes: nullableString,
  meal_time: z.union([z.enum([...MEAL_TYPES]), z.null()]).optional().transform((v) => v ?? null),
  is_food: z.boolean(),
  question: nullableString,
})
export type PhotoExtraction = z.infer<typeof photoExtractionSchema>

export function buildPhotoExtractPrompt(libraryNames: string[], clarification?: string | null): string {
  let prompt = `You identify the foods in a photo of a meal and return ONLY valid JSON, no other text.

Schema:
{
  "items": [
    {
      "query": "concise search term for a food-composition database (e.g. 'chicken breast grilled', 'jasmine rice cooked')",
      "grams": number,
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
  "food_name": "brief summary of the whole plate",
  "notes": "context or null",
  "meal_time": "breakfast" | "lunch" | "dinner" | "snack" | null,
  "is_food": boolean,
  "question": string or null
}

Rules:
- One item per distinct food on the plate. "query" must be a concise noun phrase that matches a food-composition database (Dutch NEVO or Open Food Facts). Use English unless it is a typically Dutch food (then keep the Dutch name). Include cooking state when visible ("grilled", "cooked").
- "grams": estimate the TOTAL grams of that food actually on the plate, using visual portion cues (plate/cutlery scale, container size). Always a positive number — this is the AI's best visual guess that the user can adjust.
- Estimated macros are a fallback if the database lookup fails — make them reasonable for the estimated grams.
- "is_food": true if the photo shows food/drink that can be logged — INCLUDING food shown on a phone/computer/TV screen, in a printed photo, or on a menu picture (users often log a meal from a picture of it). Analyze such indirect images exactly like a real plate; portion cues are weaker there, so lean on typical serving sizes. Only false when there is no identifiable food at all (a person, a receipt, an empty table, etc.). When false, set "items" to [] and put a short friendly retry message in "question".
- "question": when you genuinely cannot tell what a food is, or the dish is ambiguous in a way that materially changes the macros, set ONE short question in the same language the meal looks labelled in (default English). When you ask, you may still return your best-guess items. Otherwise null. Never ask about trivia (exact brand, oil amounts).`

  if (libraryNames.length > 0) {
    prompt += `\n\nSaved meals and foods (if the plate clearly is one of these, return ONE item whose query is the exact saved name):\n${libraryNames.map((n) => `- ${n}`).join('\n')}`
  }

  if (clarification) {
    prompt += `\n\nThe user clarified: "${clarification}". Use this to resolve the identification and set "question" to null.`
  }

  return prompt
}

/** Sends the meal photo to Claude vision and returns the validated extraction. */
export async function parsePhotoBytes(
  bytes: Buffer,
  mediaType: MediaType,
  opts: { libraryNames: string[]; clarification?: string | null },
): Promise<PhotoExtraction> {
  const content: Anthropic.Messages.ContentBlockParam[] = [
    ...toFileContentBlocks(bytes, mediaType),
    { type: 'text', text: 'Identify the foods in this meal photo.' },
  ]
  const msg = await getAnthropic().messages.create({
    model: PHOTO_MODEL,
    max_tokens: 1500,
    thinking: { type: 'between_tools' },
    output_config: { effort: 'low' },
    system: buildPhotoExtractPrompt(opts.libraryNames, opts.clarification),
    messages: [{ role: 'user', content }],
  })
  const block = msg.content.find((b) => b.type === 'text')
  const rawText = block && block.type === 'text' ? block.text : ''
  let json: unknown
  try {
    json = JSON.parse(stripFences(rawText))
  } catch {
    throw new Error('Could not read the foods in that photo. Try another photo.')
  }
  const parsed = photoExtractionSchema.safeParse(json)
  if (!parsed.success) throw new Error('The photo analysis was incomplete. Try another photo.')
  return parsed.data
}
