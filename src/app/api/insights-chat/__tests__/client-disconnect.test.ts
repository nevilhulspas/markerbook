/**
 * Pins the AI SDK behaviour the insights route depends on for OTH-40: an
 * answer must survive a client that goes away mid-stream.
 *
 * Unlike route.test.ts this file does NOT mock `ai` — the whole point is to
 * exercise the real stream plumbing, because the bug lived there. Cancelling
 * the response body cascades back to the stream's `onEnd`, which is where
 * the route saves the reply. Without `consumeSseStream` that callback fires on
 * whatever had streamed so far, so a phone locking mid-answer saved an EMPTY
 * assistant message and the rest of the reply was generated and dropped.
 */
import { describe, it, expect } from 'vitest'
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  consumeStream,
} from 'ai'

const ANSWER = ['Your ', 'TSH ', 'is ', 'fine ', 'and ', 'here ', 'is ', 'why.']
const FULL_ANSWER = ANSWER.join('')

/**
 * Streams the answer word by word, hands the response to a client that reads
 * two chunks and then vanishes, and returns the text `onEnd` would persist.
 */
async function textSavedAfterDisconnect({
  keepGenerating,
}: {
  keepGenerating: boolean
}): Promise<string | null> {
  let saved: string | null = null
  const finished = new Promise<void>((resolve) => {
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({ type: 'start' })
        writer.write({ type: 'text-start', id: 't1' })
        for (const delta of ANSWER) {
          writer.write({ type: 'text-delta', id: 't1', delta })
          await new Promise((tick) => setTimeout(tick, 5)) // the model's pace
        }
        writer.write({ type: 'text-end', id: 't1' })
      },
      onEnd: ({ responseMessage }) => {
        saved = (responseMessage.parts as Array<{ type: string; text?: string }>)
          .filter((part) => part.type === 'text')
          .map((part) => part.text ?? '')
          .join('')
        resolve()
      },
    })

    const response = createUIMessageStreamResponse(
      keepGenerating ? { stream, consumeSseStream: consumeStream } : { stream }
    )

    void (async () => {
      const reader = response.body!.getReader()
      await reader.read()
      await reader.read()
      await reader.cancel() // the connection drops
    })()
  })

  // Bounded so a hang fails the test instead of stalling the suite. The timer
  // is cleared either way: a stray 2s timeout would outlive the test.
  let timer: ReturnType<typeof setTimeout> | undefined
  await Promise.race([
    finished,
    new Promise((stop) => {
      timer = setTimeout(stop, 2_000)
    }),
  ])
  clearTimeout(timer)
  return saved
}

describe('an insights answer whose client disconnects', () => {
  it('is saved in full when the response stream is tee’d and drained server-side', async () => {
    expect(await textSavedAfterDisconnect({ keepGenerating: true })).toBe(FULL_ANSWER)
  })

  it('is truncated without that drain — the regression this guards against', async () => {
    const saved = await textSavedAfterDisconnect({ keepGenerating: false })
    // Assert the SHAPE of the loss, not merely "not the full answer" — a
    // timeout would satisfy that on its own and the test would pass while
    // proving nothing. What the bug does is cut the reply short: onEnd
    // fires on whatever had streamed, which is a strict prefix (in practice
    // the empty string, since the drop beats the first token).
    expect(saved).not.toBeNull()
    expect(FULL_ANSWER.startsWith(saved as string)).toBe(true)
    expect(saved).not.toBe(FULL_ANSWER)
  })
})
