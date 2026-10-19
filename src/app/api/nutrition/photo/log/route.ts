import { supabaseAdmin } from '@/lib/supabase/admin'
import { authenticateNutritionRequest } from '@/lib/nutrition/request-auth'
import { detectMediaType } from '@/lib/health-documents/media-type'
import { photoLogBodySchema } from '@/lib/validations/nutrition'
import { logConfirmedItems, type ConfirmedItem, type FoodLogInsertRow } from '@/lib/nutrition/log-core'
import { MAX_PHOTO_BYTES } from '@/lib/nutrition/photo-deps'

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
}

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

  let payload: unknown
  try {
    payload = JSON.parse((form.get('payload') as string | null) ?? '')
  } catch {
    return Response.json({ error: "Invalid 'payload' JSON" }, { status: 400 })
  }
  const parsed = photoLogBodySchema.safeParse(payload)
  if (!parsed.success) return Response.json({ error: 'Invalid payload' }, { status: 400 })
  const body = parsed.data

  // Upload the photo (service client; path is namespaced by user id).
  const imagePath = `${userId}/${crypto.randomUUID()}.${EXT[mediaType] ?? 'jpg'}`
  const { error: upErr } = await supabaseAdmin.storage
    .from('meal-photos')
    .upload(imagePath, bytes, { contentType: mediaType, upsert: false })
  if (upErr) {
    console.error('[photo/log] upload failed:', upErr)
    return Response.json({ error: 'Could not save the photo.' }, { status: 500 })
  }

  const items: ConfirmedItem[] = body.items.map((it) => ({
    query: it.query,
    grams: it.grams,
    per100: it.per100,
    weightEstimated: it.weightEstimated,
    matchSource: it.matchSource,
    matchRef: it.matchRef,
    recipeId: it.recipeId,
    customFoodId: it.customFoodId,
  }))

  let result
  try {
    result = await logConfirmedItems(
      {
        insertRows: async (rows: FoodLogInsertRow[]) => {
          const { error } = await supabaseAdmin.from('food_logs').insert(rows)
          return { error: error?.message ?? null }
        },
      },
      {
        userId,
        source: 'photo',
        foodName: body.food_name,
        notes: body.notes,
        mealOverride: body.meal,
        dateOverride: body.date,
        imagePath,
        items,
      },
    )
  } catch (e) {
    console.error('[photo/log] insert failed:', e)
    await supabaseAdmin.storage.from('meal-photos').remove([imagePath]).catch(() => {})
    return Response.json({ error: 'Could not log that meal.' }, { status: 500 })
  }

  const matched = body.items.filter((i) => ['nevo', 'off', 'legacy_usda'].includes(i.matchSource)).length
  const library = body.items.filter((i) => ['recipe', 'custom_food'].includes(i.matchSource)).length
  const estimated = body.items.filter((i) => ['estimate', 'manual'].includes(i.matchSource)).length

  const { totals, items: logged, foodName } = result
  return Response.json({
    calories: totals.kcal,
    protein_g: totals.protein,
    carbs_g: totals.carbs,
    fat_g: totals.fat,
    fiber_g: totals.fiber,
    sugar_g: totals.sugar,
    sodium_mg: totals.sodium_mg,
    saturated_fat_g: totals.sat_fat,
    food_name: foodName,
    image_path: result.imagePath,
    items: logged.map((it) => ({ name: it.name, grams: it.grams, match_source: it.matchSource })),
    match_summary: { matched, library, estimated },
  })
}
