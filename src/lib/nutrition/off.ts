import { contactForUserAgent } from '@/lib/site-url'
import type { Macros100 } from './match'

export interface OffCandidate {
  barcode: string
  name: string // product_name, plus ' — ' + brands when brands present
  per100g: Macros100
}

interface OffNutriments {
  'energy-kcal_100g'?: number
  'proteins_100g'?: number
  'carbohydrates_100g'?: number
  'fat_100g'?: number
  'fiber_100g'?: number
  'sugars_100g'?: number
  'saturated-fat_100g'?: number
  'sodium_100g'?: number
}

interface OffProduct {
  code?: string
  product_name?: string
  brands?: string
  nutriments?: OffNutriments
}

interface OffSearchResponse {
  products?: OffProduct[]
}

const OFF_BASE = 'https://nl.openfoodfacts.org/cgi/search.pl'
const USER_AGENT = `MarkerbookNutrition/1.0 (${contactForUserAgent()})`

function toNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function mapNutriments(n: OffNutriments | undefined): Macros100 {
  return {
    kcal: toNumber(n?.['energy-kcal_100g']),
    protein: toNumber(n?.['proteins_100g']),
    carbs: toNumber(n?.['carbohydrates_100g']),
    fat: toNumber(n?.['fat_100g']),
    fiber: toNumber(n?.['fiber_100g']),
    sugar: toNumber(n?.['sugars_100g']),
    sat_fat: toNumber(n?.['saturated-fat_100g']),
    // sodium_100g is in GRAMS — multiply ×1000 to get mg
    sodium_mg: toNumber(n?.['sodium_100g']) * 1000,
  }
}

export async function searchOff(q: string, max = 5): Promise<OffCandidate[]> {
  const url = new URL(OFF_BASE)
  url.searchParams.set('search_terms', q)
  url.searchParams.set('search_simple', '1')
  url.searchParams.set('action', 'process')
  url.searchParams.set('json', '1')
  url.searchParams.set('page_size', String(max))
  url.searchParams.set('fields', 'code,product_name,brands,nutriments')

  let resp: Response
  try {
    resp = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': USER_AGENT },
    })
  } catch (err) {
    console.error('[searchOff] fetch error:', err)
    return []
  }

  if (!resp.ok) {
    console.error('[searchOff] non-200 response:', resp.status)
    return []
  }

  let data: OffSearchResponse
  try {
    data = (await resp.json()) as OffSearchResponse
  } catch (err) {
    console.error('[searchOff] JSON parse error:', err)
    return []
  }

  const candidates: OffCandidate[] = []
  for (const p of data.products ?? []) {
    if (!p.product_name?.trim()) continue
    const per100g = mapNutriments(p.nutriments)
    if (per100g.kcal <= 0) continue

    const name = p.brands?.trim()
      ? `${p.product_name.trim()} — ${p.brands.trim()}`
      : p.product_name.trim()

    candidates.push({
      barcode: p.code ?? '',
      name,
      per100g,
    })
  }
  return candidates
}
