import { after } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildDescriptionPrompt } from '@/lib/catalog/description-prompt'
import { hashBiomarkerContext } from '@/lib/catalog/description-hash'
import { DESCRIPTION_TABLE, loadDescriptionContext } from '@/lib/catalog/description-context'
import { getAnthropic } from '@/lib/ai/client'
import { REASONING_MODEL } from '@/lib/ai/models'
import { toTextStreamResponse } from '@/lib/ai/text-stream-response'
import { aiLimitResponse, takeAiRequest } from '@/lib/ai/quota'

const bodySchema = z.object({
  markerId: z.string().uuid(),
  target: z.enum(['biomarker', 'dutch_marker']).default('biomarker'),
})

/**
 * Generate the shared AI description of a catalogue marker and store it.
 *
 * The description is shown to every user, so the browser only says which
 * marker to describe: the prompt is built from catalogue data read here, and
 * the server stores the model's own text once it is complete. Nothing a client
 * sends can end up in the shared text (OTH-79).
 */
export async function POST(request: Request): Promise<Response> {
  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  let parsed: z.infer<typeof bodySchema>
  try {
    const result = bodySchema.safeParse(await request.json())
    if (!result.success) return new Response('Invalid request body', { status: 400 })
    parsed = result.data
  } catch {
    return new Response('Invalid request body', { status: 400 })
  }

  const context = await loadDescriptionContext(supabaseAdmin, parsed.target, parsed.markerId)
  if (!context) {
    return new Response('Marker not found', { status: 404 })
  }

  const quota = await takeAiRequest(user.id)
  if (!quota.ok) return aiLimitResponse(quota.error)

  const prompt = buildDescriptionPrompt(context)

  // Create Anthropic streaming response. Adaptive thinking (always on with
  // Opus 5.5) at medium effort — a short reference text needs less reasoning
  // than /api/interpret. The description itself stays short, but thinking tokens
  // share the max_tokens budget — hence the much higher cap than the ~1K the
  // visible text needs. Only the `text` event reaches the client.
  const stream = getAnthropic().messages.stream({
    model: REASONING_MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  })

  // Store the finished description after the response has streamed. A failed
  // or empty generation stores nothing (the client shows the stream error).
  after(async () => {
    let text: string
    try {
      const message = await stream.finalMessage()
      text = message.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('')
    } catch {
      return
    }
    if (!text.trim()) return
    const { error } = await supabaseAdmin.from(DESCRIPTION_TABLE[parsed.target]).upsert(
      {
        biomarker_id: parsed.markerId,
        content: text,
        content_hash: hashBiomarkerContext(context),
        model: REASONING_MODEL,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'biomarker_id' }
    )
    if (error) console.error('[catalog/describe] saving the description failed:', error.message)
  })

  return toTextStreamResponse(stream)
}
