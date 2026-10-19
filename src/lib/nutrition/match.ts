
import type { CustomFood, NevoFood, Recipe, MatchSource } from '@/lib/database.types'
import type { OffCandidate } from './off'
import { scaleTo, type Macros100 } from './macros'
import { FAST_MODEL, FAST_THINKING } from '@/lib/ai/models'
import { getAnthropic } from '@/lib/ai/client'

// Shared macro shape + scaling live in ./macros (dependency-free) so client
// components can import them without pulling the Anthropic SDK into the
// browser bundle. Re-exported here for existing server-side callers.
export { scaleTo }
export type { Macros100 }

// ---------------------------------------------------------------------------
// Library types
// ---------------------------------------------------------------------------

export interface LibraryItem {
  kind: 'custom_food' | 'recipe'
  id: string
  name: string
  default_grams: number
  per100g: Macros100
}

// ---------------------------------------------------------------------------
// Model constant
// ---------------------------------------------------------------------------

export const RERANK_MODEL = FAST_MODEL

// ---------------------------------------------------------------------------
// Converters
// ---------------------------------------------------------------------------

function n(v: number | null | undefined): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

export function libraryItemFromCustomFood(f: CustomFood): LibraryItem {
  return {
    kind: 'custom_food',
    id: f.id,
    name: f.name,
    default_grams: n(f.default_grams),
    per100g: {
      kcal: n(f.kcal_per_100g),
      protein: n(f.protein_per_100g),
      carbs: n(f.carbs_per_100g),
      fat: n(f.fat_per_100g),
      fiber: n(f.fiber_per_100g),
      sugar: n(f.sugar_per_100g),
      sodium_mg: n(f.sodium_mg_per_100g),
      sat_fat: n(f.sat_fat_per_100g),
    },
  }
}

export function libraryItemFromRecipe(r: Recipe): LibraryItem | null {
  const totalGrams = n(r.total_grams)
  if (totalGrams <= 0) return null
  const k = 100 / totalGrams
  return {
    kind: 'recipe',
    id: r.id,
    name: r.name,
    default_grams: totalGrams,
    per100g: {
      kcal: n(r.total_kcal) * k,
      protein: n(r.total_protein) * k,
      carbs: n(r.total_carbs) * k,
      fat: n(r.total_fat) * k,
      fiber: n(r.total_fiber) * k,
      sugar: n(r.total_sugar) * k,
      sodium_mg: n(r.total_sodium_mg) * k,
      sat_fat: n(r.total_sat_fat) * k,
    },
  }
}

// ---------------------------------------------------------------------------
// Normalisation (ported from caltrack library.ts)
// ---------------------------------------------------------------------------

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Library matching (faithful port of caltrack findLibraryMatch)
// ---------------------------------------------------------------------------

export function findLibraryMatch(query: string, items: LibraryItem[]): LibraryItem | null {
  if (!items.length) return null
  const q = normalizeName(query)
  if (!q) return null

  // Pass 1: substring overlap — longest shorter-side wins
  let best: { item: LibraryItem; score: number } | null = null
  for (const item of items) {
    const normItem = normalizeName(item.name)
    if (!normItem) continue
    if (q.includes(normItem) || normItem.includes(q)) {
      const score = Math.min(q.length, normItem.length)
      if (!best || score > best.score) best = { item, score }
    }
  }
  if (best) return best.item

  // Pass 2: Jaccard fallback on tokens with length > 2
  const qTokens = new Set(q.split(/\s+/).filter((w) => w.length > 2))
  if (qTokens.size === 0) return null
  let bestJ: { item: LibraryItem; score: number } | null = null
  for (const item of items) {
    const normItem = normalizeName(item.name)
    const nTokens = new Set(normItem.split(/\s+/).filter((w) => w.length > 2))
    if (nTokens.size === 0) continue
    const intersect = [...qTokens].filter((t) => nTokens.has(t)).length
    if (intersect === 0) continue
    const union = new Set([...qTokens, ...nTokens]).size
    const j = intersect / union
    if (j >= 0.5 && (!bestJ || j > bestJ.score)) bestJ = { item, score: j }
  }
  return bestJ?.item ?? null
}

// ---------------------------------------------------------------------------
// Rerank via Anthropic Haiku (port of caltrack pickBestMatchWithLlm, generalized)
// ---------------------------------------------------------------------------

const RERANK_SYSTEM = `Pick the best match for the user's food from these candidates from food-composition databases.
Rules:
- Prefer plain, unprocessed forms unless the user said otherwise (e.g. "chicken breast" -> plain cooked chicken breast, not breaded).
- Match cooking state when stated ("cooked", "raw", "grilled").
- If the user mentioned a specific brand, prefer that brand.
- If no candidate is a reasonable match, reply "none".
Reply with ONLY the candidate index number (e.g. "2"), or "none". No other text.`

export async function rerankCandidates(
  item: { query: string; grams: number | null },
  candidates: { label: string }[]
): Promise<number | null> {
  if (candidates.length === 0) return null

  const amountStr = item.grams != null ? `${item.grams}g` : 'no amount stated'
  const candidateList = candidates.map((c, i) => `${i}. ${c.label}`).join('\n')
  const userMessage = `User said: "${item.query}" (${amountStr})\nCandidates:\n${candidateList}`

  let rawText: string
  try {
    const msg = await getAnthropic().messages.create({
      model: RERANK_MODEL,
      thinking: FAST_THINKING,
      max_tokens: 10,
      system: RERANK_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    })
    const block = msg.content.find((b) => b.type === 'text')
    rawText = block?.type === 'text' ? block.text.trim() : ''
  } catch (err) {
    console.error('[rerankCandidates] API error:', err)
    return null
  }

  if (rawText === 'none') return null
  const idx = parseInt(rawText, 10)
  if (Number.isInteger(idx) && idx >= 0 && idx < candidates.length) return idx
  return null
}

// ---------------------------------------------------------------------------
// matchItem — the full pipeline
// ---------------------------------------------------------------------------

export interface MatchedItem {
  source: MatchSource
  ref: string | null
  recipeId: string | null
  customFoodId: string | null
  name: string
  grams: number
  macros: Macros100
}

export interface MatchDeps {
  library: LibraryItem[]
  searchNevo: (q: string) => Promise<NevoFood[]>
  searchOff: (q: string) => Promise<OffCandidate[]>
  rerank: typeof rerankCandidates
}

export async function matchItem(
  item: { query: string; grams: number | null; estimated: Macros100 },
  deps: MatchDeps
): Promise<MatchedItem> {
  // 1. Library hit
  const libraryHit = findLibraryMatch(item.query, deps.library)
  if (libraryHit) {
    const grams = item.grams ?? libraryHit.default_grams
    return {
      source: libraryHit.kind,
      ref: null,
      recipeId: libraryHit.kind === 'recipe' ? libraryHit.id : null,
      customFoodId: libraryHit.kind === 'custom_food' ? libraryHit.id : null,
      name: libraryHit.name,
      grams,
      macros: scaleTo(libraryHit.per100g, grams),
    }
  }

  // 2. External search — NEVO + OFF in parallel
  const [nevoResults, offResults] = await Promise.all([
    deps.searchNevo(item.query),
    deps.searchOff(item.query),
  ])

  type CandidateMeta =
    | { kind: 'nevo'; food: NevoFood }
    | { kind: 'off'; food: OffCandidate }

  const allCandidates: { label: string; meta: CandidateMeta }[] = []

  for (const food of nevoResults) {
    const kcalStr = food.kcal_per_100g != null ? `${food.kcal_per_100g}` : '?'
    const displayName = food.name_en ? `${food.name_en} (${food.name_nl})` : food.name_nl
    allCandidates.push({
      label: `${displayName} — ${kcalStr} kcal/100g`,
      meta: { kind: 'nevo', food },
    })
  }

  for (const food of offResults) {
    allCandidates.push({
      label: `${food.name} — ${food.per100g.kcal} kcal/100g [branded]`,
      meta: { kind: 'off', food },
    })
  }

  if (allCandidates.length > 0) {
    const pickedIdx = await deps.rerank(
      { query: item.query, grams: item.grams },
      allCandidates.map((c) => ({ label: c.label }))
    )

    if (pickedIdx != null) {
      const picked = allCandidates[pickedIdx]
      const grams = item.grams ?? 100

      if (picked.meta.kind === 'nevo') {
        const food = picked.meta.food
        const per100g: Macros100 = {
          kcal: n(food.kcal_per_100g),
          protein: n(food.protein_per_100g),
          carbs: n(food.carbs_per_100g),
          fat: n(food.fat_per_100g),
          fiber: n(food.fiber_per_100g),
          sugar: n(food.sugar_per_100g),
          sodium_mg: n(food.sodium_mg_per_100g),
          sat_fat: n(food.sat_fat_per_100g),
        }
        return {
          source: 'nevo',
          ref: food.nevo_code,
          recipeId: null,
          customFoodId: null,
          name: food.name_nl,
          grams,
          macros: scaleTo(per100g, grams),
        }
      } else {
        const food = picked.meta.food
        return {
          source: 'off',
          ref: food.barcode,
          recipeId: null,
          customFoodId: null,
          name: food.name,
          grams,
          macros: scaleTo(food.per100g, grams),
        }
      }
    }
  }

  // 3. Fallback to estimate
  return {
    source: 'estimate',
    ref: null,
    recipeId: null,
    customFoodId: null,
    name: item.query,
    grams: item.grams ?? 0,
    macros: item.estimated,
  }
}
