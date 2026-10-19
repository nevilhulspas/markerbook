/**
 * Read a JSON request body, refusing bodies above `maxBytes`. The AI routes
 * build their prompts from fields the browser sends, so an unbounded body is
 * an unbounded AI bill.
 */
export async function readJsonBody<T>(
  request: Request,
  maxBytes: number
): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  const declared = Number(request.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: new Response('Request body too large', { status: 413 }) }
  }
  let text: string
  try {
    text = await request.text()
  } catch {
    return { ok: false, response: new Response('Invalid request body', { status: 400 }) }
  }
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return { ok: false, response: new Response('Request body too large', { status: 413 }) }
  }
  try {
    return { ok: true, value: JSON.parse(text) as T }
  } catch {
    return { ok: false, response: new Response('Invalid request body', { status: 400 }) }
  }
}
