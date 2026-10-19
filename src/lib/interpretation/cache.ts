import type { MarkerContext, ProfileContext } from './types'

/**
 * Simple non-crypto hash function (djb2 variant).
 * Used for cache invalidation, not security.
 */
export function simpleHash(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}

/**
 * Create a deterministic hash from profile fields.
 * Changes when any profile field is updated.
 */
export function hashProfile(profile: ProfileContext): string {
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(profile).sort()) {
    sorted[key] = profile[key as keyof ProfileContext]
  }
  return simpleHash(JSON.stringify(sorted))
}

/**
 * Create a deterministic hash from all marker values.
 * Changes when test results are added, removed, or modified.
 */
export function hashMarkerContext(markers: MarkerContext[]): string {
  const sorted = [...markers]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => ({
      name: m.name,
      value: m.value,
      unit: m.unit,
      refRangeLow: m.refRangeLow,
      refRangeHigh: m.refRangeHigh,
      status: m.status,
    }))
  return simpleHash(JSON.stringify(sorted))
}
