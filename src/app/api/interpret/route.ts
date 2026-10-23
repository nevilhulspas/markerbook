import { createClient } from '@/lib/supabase/server'
import { buildSingleMarkerPrompt, buildFullTestPrompt } from '@/lib/interpretation/prompt'
import { buildInsightPrompt } from '@/lib/interpretation/insight-prompt'
import {
  loadBiomarkerHistory,
  loadProfileContext,
  loadTestContext,
} from '@/lib/interpretation/server-context'
import type { InterpretationType } from '@/lib/interpretation/types'
import { getAnthropic } from '@/lib/ai/client'
import { REASONING_MODEL } from '@/lib/ai/models'
import { toTextStreamResponse } from '@/lib/ai/text-stream-response'
import { aiLimitResponse, takeAiRequest } from '@/lib/ai/quota'
import { aiNotConfiguredResponse, isAiConfigured } from '@/lib/ai/config'
import { readJsonBody } from '@/lib/http/read-json'

const TYPES: InterpretationType[] = ['single_marker', 'full_test', 'biomarker_insight']

/**
 * Only WHICH record to interpret is taken from the request (type, test id,
 * result id). The markers, ranges, history and profile in the prompt are
 * loaded from the caller's own data (server-context.ts); anything else the
 * screens still send along is ignored.
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
  if (!isAiConfigured()) return aiNotConfiguredResponse()

  const read = await readJsonBody<Record<string, unknown>>(request, 300_000)
  if (!read.ok) return read.response
  const { type, bloodTestId, testResultId } = read.value
  if (
    !TYPES.includes(type as InterpretationType) ||
    typeof bloodTestId !== 'string' ||
    (testResultId !== undefined && typeof testResultId !== 'string') ||
    (type !== 'full_test' && typeof testResultId !== 'string')
  ) {
    return new Response('Invalid interpretation request', { status: 400 })
  }

  const { profile, sex } = await loadProfileContext(supabase, user.id)

  let prompt: { system: string; user: string }
  if (type === 'biomarker_insight') {
    const history = await loadBiomarkerHistory(supabase, user.id, testResultId as string, sex)
    if (!history) return new Response('Result not found', { status: 404 })
    prompt = buildInsightPrompt({
      biomarkerName: history.biomarkerName,
      unit: history.unit,
      values: history.values,
      refRangeLow: history.refRangeLow,
      refRangeHigh: history.refRangeHigh,
      profile,
    })
  } else {
    const test = await loadTestContext(supabase, user.id, bloodTestId, sex)
    if (!test) return new Response('Test not found', { status: 404 })
    const allTestResults = test.results.map((r) => r.context)
    const base = { userId: user.id, bloodTestId, allTestResults, profile }
    if (type === 'single_marker') {
      const focused = test.results.find((r) => r.id === testResultId)
      if (!focused) return new Response('Result not found', { status: 404 })
      prompt = buildSingleMarkerPrompt({
        ...base,
        type,
        testResultId: focused.id,
        markerName: focused.biomarkerName,
        markerValue: focused.context.value,
        markerUnit: focused.context.unit,
        refRangeLow: focused.context.refRangeLow,
        refRangeHigh: focused.context.refRangeHigh,
        status: focused.context.status,
      })
    } else {
      prompt = buildFullTestPrompt({ ...base, type: 'full_test', markerName: test.name })
    }
  }

  const quota = await takeAiRequest(user.id)
  if (!quota.ok) return aiLimitResponse(quota.error)

  // Create Anthropic streaming response. Adaptive thinking (always on with
  // Opus 5.5) + high effort: the interpretation is the app's flagship output,
  // so let the model reason before answering. Thinking tokens count toward
  // max_tokens; the answer itself is a few hundred words, so 32k leaves ample
  // room for both while capping what one request can cost. The `text` stream
  // event below only fires for visible text, so thinking never leaks into the
  // response body.
  const stream = getAnthropic().messages.stream({
    model: REASONING_MODEL,
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  })

  return toTextStreamResponse(stream)
}
