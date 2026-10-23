import { createClient } from '@/lib/supabase/server'
import { buildChatSystemPrompt } from '@/lib/interpretation/chat-prompt'
import { loadProfileContext, loadTestContext } from '@/lib/interpretation/server-context'
import { getAnthropic } from '@/lib/ai/client'
import { REASONING_MODEL } from '@/lib/ai/models'
import { toTextStreamResponse } from '@/lib/ai/text-stream-response'
import { aiLimitResponse, takeAiRequest } from '@/lib/ai/quota'
import { aiNotConfiguredResponse, isAiConfigured } from '@/lib/ai/config'
import { readJsonBody } from '@/lib/http/read-json'

/** Messages sent to the model (the conversation's tail). */
const MAX_MESSAGES = 20
/** Characters per message: the first one is the interpretation itself. */
const MAX_MESSAGE_CHARS = 40_000

type ChatMessage = { role: 'user' | 'assistant'; content: string }

function isChatMessage(m: unknown): m is ChatMessage {
  const { role, content } = (m ?? {}) as Record<string, unknown>
  return (
    (role === 'user' || role === 'assistant') &&
    typeof content === 'string' &&
    content.length <= MAX_MESSAGE_CHARS
  )
}

/**
 * Follow-up chat under an interpretation. The conversation (which opens with
 * the interpretation itself) comes from the request; the markers and profile
 * are loaded from the caller's own data for the given test (and result).
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
  const { messages: rawMessages, bloodTestId, testResultId } = read.value

  // Validate messages
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return new Response('Messages array is required and must not be empty', {
      status: 400,
    })
  }
  // Cap messages to the last entries to prevent context window explosion
  const messages = rawMessages.slice(-MAX_MESSAGES)
  if (!messages.every(isChatMessage)) {
    return new Response('Invalid messages', { status: 400 })
  }
  if (messages[messages.length - 1].role !== 'user') {
    return new Response('Last message must be from user', { status: 400 })
  }
  if (typeof bloodTestId !== 'string' || (testResultId !== undefined && typeof testResultId !== 'string')) {
    return new Response('Invalid chat context', { status: 400 })
  }

  const { profile, sex } = await loadProfileContext(supabase, user.id)
  const test = await loadTestContext(supabase, user.id, bloodTestId, sex)
  if (!test) return new Response('Test not found', { status: 404 })
  const focused = testResultId ? test.results.find((r) => r.id === testResultId) : undefined
  if (testResultId && !focused) return new Response('Result not found', { status: 404 })

  const quota = await takeAiRequest(user.id)
  if (!quota.ok) return aiLimitResponse(quota.error)

  const systemPrompt = buildChatSystemPrompt({
    allTestResults: test.results.map((r) => r.context),
    profile,
    markerName: focused?.biomarkerName ?? test.name,
  })

  // Create Anthropic streaming response. Opus 5.5 always runs adaptive
  // thinking — the model reasons only as far as the question warrants, steered
  // by effort (`high`; xhigh is meant for 30+ minute agentic runs). Thinking
  // tokens count toward max_tokens; a follow-up answer is 2-4 paragraphs, so
  // 16k caps the cost of one request with room to spare. The `text` event only
  // fires for visible text, so thinking never reaches the client.
  const stream = getAnthropic().messages.stream({
    model: REASONING_MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  })

  return toTextStreamResponse(stream)
}
