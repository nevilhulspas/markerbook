import { authenticateNutritionRequest } from '@/lib/nutrition/request-auth'
import { detectMediaType } from '@/lib/health-documents/media-type'
import { parsePhotoBytes } from '@/lib/nutrition/photo-parse'
import { analyzePhoto } from '@/lib/nutrition/photo-analyze'
import { buildPhotoMatchDeps, MAX_PHOTO_BYTES } from '@/lib/nutrition/photo-deps'
import { takeAiRequest } from '@/lib/ai/quota'

export async function POST(req: Request): Promise<Response> {
  const userId = await authenticateNutritionRequest(req)
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file = form.get('image')
  if (!(file instanceof File)) return Response.json({ error: "Missing 'image'" }, { status: 400 })
  if (file.size > MAX_PHOTO_BYTES) {
    return Response.json({ error: 'Photo is too large (max 10MB).' }, { status: 413 })
  }
  const bytes = Buffer.from(await file.arrayBuffer())
  const mediaType = detectMediaType(bytes)
  if (!mediaType || mediaType === 'application/pdf') {
    return Response.json({ error: 'Upload a photo (JPEG/PNG/WebP/GIF).' }, { status: 400 })
  }

  const clarification = ((form.get('clarification') as string | null) ?? '').trim() || null

  const quota = await takeAiRequest(userId)
  if (!quota.ok) return Response.json({ error: quota.error }, { status: 429 })

  const deps = await buildPhotoMatchDeps(userId)
  try {
    const analysis = await analyzePhoto(
      { ...deps, parsePhoto: (opts) => parsePhotoBytes(bytes, mediaType, opts) },
      { clarification },
    )
    return Response.json(analysis)
  } catch (e) {
    console.error('[photo/analyze] failed:', e)
    return Response.json({ error: 'Could not analyze that photo.' }, { status: 502 })
  }
}
