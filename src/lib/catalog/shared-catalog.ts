import type { TypedSupabaseClient } from '@/lib/supabase/database'
import { sameUnit } from '@/lib/units/parse'

/**
 * Guards for writes into the SHARED catalogue (`biomarkers`, `microbiome_taxa`).
 * Every user sees these rows, so a user-triggered write may only add a new row
 * with a clean name; the unit and reference range come from trusted data
 * (LOINC, or an admin), never from what one user typed or one user's report.
 * The user's own unit stays on their result and in their display preference.
 */

export const MAX_CATALOG_NAME_LENGTH = 120
export const MAX_CATALOG_CATEGORY_LENGTH = 60

// Control and format characters (incl. zero-width and bidi overrides).
const INVISIBLE = /[\p{Cc}\p{Cf}]/gu
const HAS_INVISIBLE = /[\p{Cc}\p{Cf}]/u

/**
 * A name or category fit for a shared row: invisible characters removed,
 * whitespace collapsed, trimmed and cut to `max` characters. Null when nothing
 * is left.
 */
export function cleanCatalogText(
  raw: string | null | undefined,
  max: number = MAX_CATALOG_NAME_LENGTH
): string | null {
  const cleaned = (raw ?? '').replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim()
  if (!cleaned) return null
  const chars = Array.from(cleaned)
  return chars.length > max ? chars.slice(0, max).join('').trim() : cleaned
}

/**
 * The lab spelling of a LOINC EXAMPLE_UCUM_UNITS value: "10*3/uL" → "10^3/uL",
 * "[IU]/L" → "IU/L", annotations like "{ratio}" dropped. Null when no unit is
 * left or the value does not look like a unit.
 */
export function loincUnitToLabUnit(raw: string | null | undefined): string | null {
  const first = (raw ?? '').split(';')[0] ?? ''
  const unit = first
    .replace(/\{[^}]*\}/g, '')
    .replace(/\[([^\]]*)\]/g, '$1')
    .replace(/10\*/g, '10^')
    .trim()
  if (!unit || unit.length > 30 || HAS_INVISIBLE.test(unit)) return null
  return unit
}

/**
 * Keep showing a new shared marker in the unit its creator entered: store that
 * unit as the creator's display preference when it differs from the catalogue
 * unit. Never replaces a preference the user already set. Best-effort.
 */
export async function rememberCreatorUnit(
  db: TypedSupabaseClient,
  userId: string | null | undefined,
  biomarkerId: string,
  creatorUnit: string | null | undefined,
  catalogueUnit: string
): Promise<void> {
  const unit = cleanCatalogText(creatorUnit, 30)
  if (!userId || !unit) return
  if (catalogueUnit && sameUnit(unit, catalogueUnit)) return
  const { error } = await db
    .from('user_unit_preferences')
    .upsert(
      { user_id: userId, biomarker_id: biomarkerId, preferred_unit: unit },
      { onConflict: 'user_id,biomarker_id', ignoreDuplicates: true }
    )
  if (error) console.error('rememberCreatorUnit: could not save the display unit', error.message)
}

let creatorColumnExists = false

/**
 * `{ created_by }` for a new shared row, or `{}` while the database does not
 * have the column yet. Migration 20261023120200 adds it to `biomarkers` and
 * `microbiome_taxa` together; the hosted database gets it only once that
 * migration is applied by hand, and an insert naming a missing column fails.
 * A positive check is remembered for the life of the process.
 */
export async function creatorFields(
  db: TypedSupabaseClient,
  userId: string | null | undefined
): Promise<{ created_by?: string }> {
  if (!userId) return {}
  if (!creatorColumnExists) {
    const { error } = await db.from('biomarkers').select('created_by').limit(0)
    creatorColumnExists = error === null
  }
  return creatorColumnExists ? { created_by: userId } : {}
}
