import { authenticateNutritionRequest } from '@/lib/nutrition/request-auth'
import { takeAiRequest } from '@/lib/ai/quota'

/** Whisper's own upload limit; anything larger would only fail upstream. */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024
/** Room for the multipart framing around the file. */
const MAX_BODY_BYTES = MAX_AUDIO_BYTES + 64 * 1024

export async function POST(req: Request): Promise<Response> {
  // Auth: token (iPhone Shortcut) or the session cookie (in-app voice recorder).
  const userId = await authenticateNutritionRequest(req)
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Refuse an oversized upload before reading it into memory.
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (declared > MAX_BODY_BYTES) {
    return Response.json({ error: 'Audio file is too large (max 25 MB)' }, { status: 413 })
  }

  // Check for OpenAI key
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    return Response.json({ error: 'Transcription not configured' }, { status: 503 })
  }

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: 'Invalid multipart body' }, { status: 400 })
  }

  // Accept any File field — the iOS Shortcut may use arbitrary field names
  let file: File | null = null
  for (const [, value] of formData.entries()) {
    if (value instanceof File) {
      file = value
      break
    }
  }

  if (!file) {
    return Response.json({ error: 'No audio file in request' }, { status: 400 })
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: 'Audio file is too large (max 25 MB)' }, { status: 413 })
  }

  const quota = await takeAiRequest(userId)
  if (!quota.ok) return Response.json({ error: quota.error }, { status: 429 })

  // Forward to OpenAI Whisper
  const outForm = new FormData()
  outForm.append('file', file, file.name || 'audio.m4a')
  outForm.append('model', 'whisper-1')
  outForm.append('response_format', 'json')

  let resp: Response
  try {
    resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: outForm,
    })
  } catch (err) {
    console.error('[transcribe] fetch to OpenAI failed:', err)
    return Response.json({ error: 'Transcription service unavailable' }, { status: 502 })
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'unknown error')
    console.error('[transcribe] Whisper API error:', resp.status, errText)
    return Response.json({ error: 'Transcription service unavailable' }, { status: 502 })
  }

  let data: { text?: string }
  try {
    data = (await resp.json()) as { text?: string }
  } catch {
    return Response.json({ error: 'Invalid response from transcription service' }, { status: 502 })
  }

  return Response.json({ text: data.text ?? '' })
}
