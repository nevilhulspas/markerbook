// Plain-text AI streams between our API routes and the browser.
//
// A failure after streaming has started cannot change the 200 status any
// more. The server then appends STREAM_ERROR_MARKER + message and closes the
// stream; readTextStream() turns that into a thrown Error, so callers show the
// error and never save the partial text as if it were a finished answer.
// Client-safe: no SDK imports here.

/** Record separator: never part of model text, and a single UTF-8 byte. */
const SEPARATOR = '\u001e'
export const STREAM_ERROR_MARKER = `${SEPARATOR}stream-error:`

/**
 * Read a text stream to the end, reporting visible text through `onText`.
 * Resolves with the full text, or throws the server's error message.
 */
export async function readTextStream(
  response: Response,
  onText: (chunk: string) => void
): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let raw = ''
  let shown = 0 // length of `raw` already passed to onText

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    raw += decoder.decode(value, { stream: true })
    const visibleEnd = raw.includes(SEPARATOR) ? raw.indexOf(SEPARATOR) : raw.length
    if (visibleEnd > shown) {
      onText(raw.slice(shown, visibleEnd))
      shown = visibleEnd
    }
  }
  raw += decoder.decode()

  const markerAt = raw.indexOf(STREAM_ERROR_MARKER)
  if (markerAt !== -1) {
    const message = raw.slice(markerAt + STREAM_ERROR_MARKER.length).trim()
    throw new Error(message || 'The AI response failed')
  }
  return raw
}
