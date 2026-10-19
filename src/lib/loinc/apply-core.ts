import type { MappingDecision } from './types'

export function buildBiomarkerUpdate(
  d: MappingDecision,
  current: { name: string },
): { id: string; fields: Record<string, string | null> } | null {
  if (d.decision === 'skip' || !d.loincCode) return null
  const fields: Record<string, string | null> = { loinc_code: d.loincCode, method: d.method }
  if (d.displayNameOverride && d.displayNameOverride !== current.name) fields.name = d.displayNameOverride
  return { id: d.id, fields }
}
