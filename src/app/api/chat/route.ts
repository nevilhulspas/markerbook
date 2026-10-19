import { createClient } from '@/lib/supabase/server'
import { buildChatSystemPrompt } from '@/lib/interpretation/chat-prompt'
import type { MarkerContext, ProfileContext } from '@/lib/interpretation/types'
import { getAnthropic } from '@/lib/ai/client'
import { REASONING_MODEL } from '@/lib/ai/models'
import { toTextStreamResponse } from '@/lib/ai/text-stream-response'
import { aiLimitResponse, takeAiRequest } from '@/lib/ai/quota'
import { readJsonBody } from '@/lib/http/read-json'

interface ChatRequestBody {
  messages: { role: 'user' | 'assistant'; content: string }[]
  allTestResults: MarkerContext[]
  profile: ProfileContext
  markerName?: string
  interpretationContent?: string
}

export async function POST(request: Request): Promise<Response> {
  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const read = await readJsonBody<ChatRequestBody>(request, 300_000)
  if (!read.ok) return read.response
  const body = read.value

  // Validate messages
  if (!body.messages || body.messages.length === 0) {
    return new Response('Messages array is required and must not be empty', {
      status: 400,
    })
  }

  const lastMessage = body.messages[body.messages.length - 1]
  if (lastMessage.role !== 'user') {
    return new Response('Last message must be from user', { status: 400 })
  }

  const quota = await takeAiRequest(user.id)
  if (!quota.ok) return aiLimitResponse(quota.error)

  // Cap messages to last 20 entries to prevent context window explosion
  const messages = body.messages.slice(-20)

  const systemPrompt = buildChatSystemPrompt({
    allTestResults: body.allTestResults,
    profile: body.profile,
    markerName: body.markerName,
    interpretationContent: body.interpretationContent,
  })

  // Create Anthropic streaming response. Opus 5.5 always runs adaptive
  // thinking — the model reasons only as far as the question warrants, steered
  // by effort (`high`; xhigh is meant for 30+ minute agentic runs). Thinking
  // tokens count toward max_tokens, hence the higher caps. The `text` event only fires for visible
  // text, so thinking never reaches the client.
  const stream = getAnthropic().messages.stream({
    model: REASONING_MODEL,
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  })

  return toTextStreamResponse(stream)
}
