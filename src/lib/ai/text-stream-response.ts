import 'server-only'

import type { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream'

import { aiFailureMessage } from './config'
import { STREAM_ERROR_MARKER } from './text-stream'

/**
 * Stream the visible text of an Anthropic message stream as a plain-text
 * response. Thinking never reaches the client: the `text` event only fires
 * for visible text. A mid-stream failure is logged and sent as
 * STREAM_ERROR_MARKER + a plain sentence (see readTextStream), never as
 * answer text and never as the raw SDK error.
 */
export function toTextStreamResponse(stream: MessageStream): Response {
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let closed = false
      const close = () => {
        if (closed) return
        closed = true
        controller.close()
      }

      stream.on('text', (text) => {
        if (!closed) controller.enqueue(encoder.encode(text))
      })

      stream.on('error', (error) => {
        if (closed) return
        const message = aiFailureMessage('ai-stream', error)
        controller.enqueue(encoder.encode(`${STREAM_ERROR_MARKER}${message}`))
        close()
      })

      stream.on('end', close)

      // Keep start() pending until the stream settles; the 'error' listener
      // above already reports a failure, so the rejection is handled there.
      await stream.finalMessage().catch(() => {})
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
