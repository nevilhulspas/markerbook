import { createClient } from '@/lib/supabase/server'
import { buildSingleMarkerPrompt, buildFullTestPrompt } from '@/lib/interpretation/prompt'
import { buildInsightPrompt } from '@/lib/interpretation/insight-prompt'
import type { InterpretationRequest } from '@/lib/interpretation/types'
import { getAnthropic } from '@/lib/ai/client'
import { REASONING_MODEL } from '@/lib/ai/models'
import { toTextStreamResponse } from '@/lib/ai/text-stream-response'
import { aiLimitResponse, takeAiRequest } from '@/lib/ai/quota'
import { readJsonBody } from '@/lib/http/read-json'

export async function POST(request: Request): Promise<Response> {
  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const read = await readJsonBody<InterpretationRequest>(request, 300_000)
  if (!read.ok) return read.response
  const body = read.value

  const quota = await takeAiRequest(user.id)
  if (!quota.ok) return aiLimitResponse(quota.error)

  // Build prompt based on interpretation type
  const prompt =
    body.type === 'biomarker_insight'
      ? buildInsightPrompt({
          biomarkerName: body.markerName,
          unit: body.markerUnit ?? '',
          values: body.historicalValues ?? [],
          refRangeLow: body.refRangeLow ?? null,
          refRangeHigh: body.refRangeHigh ?? null,
          profile: body.profile,
        })
      : body.type === 'single_marker'
        ? buildSingleMarkerPrompt(body)
        : buildFullTestPrompt(body)

  // Create Anthropic streaming response. Adaptive thinking (always on with
  // Opus 5.5) + high effort: the interpretation is the app's flagship output,
  // so let the model reason before answering. Thinking tokens count toward max_tokens, hence the higher cap —
  // the `text` stream event below only fires for visible text, so thinking
  // never leaks into the response body.
  const stream = getAnthropic().messages.stream({
    model: REASONING_MODEL,
    max_tokens: 64000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  })

  return toTextStreamResponse(stream)
}
