// Salvaging JSON out of model text output. The prompts ask for bare JSON, but
// models sometimes wrap it in prose or code fences, or get cut off mid-array.
// These were copied in five modules; this is the single implementation.

/**
 * The balanced `{...}` object that starts at `start`, ignoring braces inside
 * JSON strings. Null if `text[start]` is not `{` or the object never closes.
 */
export function balancedSlice(text: string, start: number): string | null {
  if (text[start] !== '{') return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

/** The first balanced top-level `{...}` in text; null if none or truncated. */
export function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  return balancedSlice(text, start)
}

/** Find `"key": { ... }` and return the balanced object substring, or null. */
export function extractKeyedObject(text: string, key: string): string | null {
  const keyIdx = text.indexOf(`"${key}"`)
  if (keyIdx === -1) return null
  const braceIdx = text.indexOf('{', keyIdx)
  if (braceIdx === -1) return null
  return balancedSlice(text, braceIdx)
}

/**
 * Find `"key": [ ... ]` and return each fully-balanced `{...}` element, in
 * order. Stops at the array's end or at the first truncated object, so a
 * response cut off mid-array still yields the complete entries before it.
 */
export function extractArrayObjects(text: string, key: string): string[] {
  const keyIdx = text.indexOf(`"${key}"`)
  if (keyIdx === -1) return []
  const arrIdx = text.indexOf('[', keyIdx)
  if (arrIdx === -1) return []

  const objects: string[] = []
  let i = arrIdx + 1
  while (i < text.length) {
    const ch = text[i]
    if (ch === ']') break
    if (ch === '{') {
      const slice = balancedSlice(text, i)
      if (slice === null) break // truncated mid-object — stop salvaging
      objects.push(slice)
      i += slice.length
    } else {
      i++
    }
  }
  return objects
}

/** Strip a surrounding ```json / ``` code fence and trim. */
export function stripFences(s: string): string {
  let t = s.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }
  return t.trim()
}
