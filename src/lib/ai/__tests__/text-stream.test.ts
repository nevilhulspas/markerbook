import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { readTextStream, STREAM_ERROR_MARKER } from '@/lib/ai/text-stream'
import { toTextStreamResponse } from '@/lib/ai/text-stream-response'
import { AI_FAILED_MESSAGE } from '@/lib/ai/messages'
import type { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream'

function responseOf(chunks: string[]): Response {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const c of chunks) controller.enqueue(encoder.encode(c))
        controller.close()
      },
    })
  )
}

/** A stand-in for the SDK's MessageStream: emits the given events in order. */
function fakeStream(events: Array<['text', string] | ['error', Error] | ['end']>): MessageStream {
  const listeners: Record<string, Array<(arg?: unknown) => void>> = {}
  let settle!: () => void
  const done = new Promise<void>((resolve) => (settle = resolve))
  const stream = {
    on(event: string, listener: (arg?: unknown) => void) {
      ;(listeners[event] ??= []).push(listener)
      return stream
    },
    finalMessage: () => done,
  }
  queueMicrotask(() => {
    for (const [name, arg] of events) for (const l of listeners[name] ?? []) l(arg)
    settle()
  })
  return stream as unknown as MessageStream
}

describe('readTextStream', () => {
  it('passes text through and resolves with the full answer', async () => {
    const seen: string[] = []
    await expect(readTextStream(responseOf(['Hel', 'lo']), (c) => seen.push(c))).resolves.toBe('Hello')
    expect(seen.join('')).toBe('Hello')
  })

  it('throws the server error and never shows the marker, even when it is split across chunks', async () => {
    const seen: string[] = []
    const marker = STREAM_ERROR_MARKER + 'Overloaded'
    const response = responseOf(['Partial answer', marker.slice(0, 5), marker.slice(5)])
    await expect(readTextStream(response, (c) => seen.push(c))).rejects.toThrow('Overloaded')
    expect(seen.join('')).toBe('Partial answer')
  })

  it('throws when there is no body', async () => {
    await expect(readTextStream(new Response(null), () => {})).rejects.toThrow('No response body')
  })
})

describe('toTextStreamResponse', () => {
  it('streams visible text and closes on end', async () => {
    const res = toTextStreamResponse(fakeStream([['text', 'a'], ['text', 'b'], ['end']]))
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
    await expect(readTextStream(res, () => {})).resolves.toBe('ab')
  })

  it('reports a failure through the marker so the reader throws', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = toTextStreamResponse(fakeStream([['text', 'partial'], ['error', new Error('rate limited')], ['end']]))
    await expect(readTextStream(res, () => {})).rejects.toThrow('rate limited')
    vi.unstubAllEnvs()
  })

  it('sends a plain sentence, not the raw SDK error', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    class SdkError extends Error {}
    const res = toTextStreamResponse(
      fakeStream([['error', new SdkError('400 {"type":"invalid_request_error"}')], ['end']])
    )
    await expect(readTextStream(res, () => {})).rejects.toThrow(AI_FAILED_MESSAGE)
    vi.unstubAllEnvs()
  })
})
