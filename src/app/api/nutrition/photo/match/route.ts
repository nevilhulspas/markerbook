import { authenticateNutritionRequest } from '@/lib/nutrition/request-auth'
import { buildPhotoMatchDeps } from '@/lib/nutrition/photo-deps'
import { matchItem } from '@/lib/nutrition/match'
import { per100From, type Macros100 } from '@/lib/nutrition/macros'

const ZEROS: Macros100 = {
  kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium_mg: 0, sat_fat: 0,
}

/**
 * Re-run the food matching pipeline for a single ingredient name.
 * Used by the photo review screen's "Change" flow — when the AI misidentifies
 * an ingredient (e.g. says "egg" but it's "vegan meat"), the user types the
 * correct name and this endpoint returns fresh per-100g macros + match metadata.
 *
 * Runs the same pipeline as the initial photo analysis (library → NEVO → OFF → rerank).
 */
export async function POST(req: Request): Promise<Response> {
  const userId = await authenticateNutritionRequest(req)
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { query?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const query = (body.query ?? '').trim()
  if (!query) return Response.json({ error: 'Missing "query"' }, { status: 400 })

  const deps = await buildPhotoMatchDeps(userId)
  try {
    const matched = await matchItem({ query, grams: 100, estimated: ZEROS }, deps)
    return Response.json({
      query: matched.name,
      per100: per100From(matched.macros, matched.grams),
      match_source: matched.source,
      match_ref: matched.ref,
      recipe_id: matched.recipeId,
      custom_food_id: matched.customFoodId,
    })
  } catch (e) {
    console.error('[photo/match] failed:', e)
    return Response.json({ error: 'Could not match that food.' }, { status: 502 })
  }
}
