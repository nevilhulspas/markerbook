import { simpleHash } from '@/lib/interpretation/cache'

export interface BiomarkerHashInput {
  name: string
  category: string
  unit: string
  referenceRanges: Array<{
    sex: string
    range_low: number | null
    range_high: number | null
    range_type: string
  }>
  panelName: string | null
  systemName: string | null
}

/**
 * Create a deterministic hash from biomarker catalog context.
 * Changes when any catalog field is updated (name, category, unit, ranges, panel, system).
 * Used for staleness detection of cached AI descriptions.
 */
export function hashBiomarkerContext(input: BiomarkerHashInput): string {
  const sorted: Record<string, unknown> = {
    name: input.name,
    category: input.category,
    unit: input.unit,
    panelName: input.panelName,
    systemName: input.systemName,
    ranges: input.referenceRanges
      .map((r) => `${r.sex}:${r.range_low}-${r.range_high}:${r.range_type}`)
      .sort()
      .join('|'),
  }
  return simpleHash(JSON.stringify(sorted))
}
