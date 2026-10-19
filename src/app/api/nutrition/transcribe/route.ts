import { resolveUserIdByToken } from '@/lib/nutrition/log-token'
import { createClient } from '@/lib/supabase/server'
import { takeAiRequest } from '@/lib/ai/quota'

function readToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return new URL(req.url).searchParams.get('token')
}

/** Token auth (iPhone Shortcut) when a token is supplied — an explicit bad
 *  token stays a hard 401. Otherwise the logged-in session cookie (in-app
 *  voice recorder) authenticates. */
async function authenticate(req: Request): Promise<string | null> {
  const token = readToken(req)
  if (token) return resolveUserIdByToken(token)

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export async function POST(req: Request): Promise<Response> {
  // Auth
  const userId = await authenticate(req)
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

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
