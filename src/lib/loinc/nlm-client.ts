import type { LoincCandidate } from './types'

const BASE = 'https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search'

export function buildSearchUrl(query: string, maxList = 15): string {
  const p = new URLSearchParams({
    terms: query,
    df: 'LOINC_NUM,LONG_COMMON_NAME',
    ef: 'COMPONENT,METHOD_TYP,units,PROPERTY',
    maxList: String(maxList),
  })
  // The NLM API expects the df/ef field lists comma-separated; restore the
  // commas that URLSearchParams percent-encodes (both forms work, but the
  // unencoded form is what callers/tests assert on).
  return `${BASE}?${p.toString()}`.replace(/%2C/g, ',')
}

type NlmResponse = [number, string[], Record<string, unknown[]>, string[][]]

export function parseLoincSearch(res: unknown): LoincCandidate[] {
  const [, codes, ef, display] = res as NlmResponse
  if (!Array.isArray(codes)) return []
  const units = ef?.units as ({ unit: string }[] | null)[] | undefined
  const comp = ef?.COMPONENT as string[] | undefined
  const method = ef?.METHOD_TYP as string[] | undefined
  const prop = ef?.PROPERTY as string[] | undefined
  return codes.map((code, i) => ({
    code,
    longName: display?.[i]?.[1] ?? '',
    component: comp?.[i] ?? '',
    ucumUnit: units?.[i]?.[0]?.unit ?? null,
    method: method?.[i] || null,
    property: prop?.[i] || null,
  }))
}

export async function searchLoinc(
  query: string,
  fetchFn: typeof fetch = fetch,
  maxList = 30,
): Promise<LoincCandidate[]> {
  const res = await fetchFn(buildSearchUrl(query, maxList))
  if (!res.ok) throw new Error(`NLM LOINC search failed: ${res.status}`)
  return parseLoincSearch(await res.json())
}
