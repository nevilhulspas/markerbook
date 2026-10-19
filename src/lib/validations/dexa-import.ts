import { z } from 'zod'

import { deriveFfmi } from '@/lib/body/metrics'

// The extraction schema makes optional fields omittable (to stay under
// Anthropic's union-param limit), so a missing key must parse to null.
const nullableNumber = z.number().nullable().default(null)

const regionEnum = z.enum([
  'arms', 'arm_left', 'arm_right', 'legs', 'leg_left', 'leg_right',
  'trunk', 'trunk_left', 'trunk_right', 'android', 'gynoid', 'total',
  'head', 'ribs', 'spine', 'pelvis',
])

export const dexaRegionSchema = z.object({
  region: regionEnum,
  fat_pct: nullableNumber,
  fat_mass_g: nullableNumber,
  lean_mass_g: nullableNumber,
  bmc_g: nullableNumber,
  total_mass_g: nullableNumber,
  bmd: nullableNumber,
  t_score: nullableNumber,
  z_score: nullableNumber,
})

export const dexaScanSchema = z.object({
  scan_date: z.string().min(1),
  provider: z.string().nullable().default(null),
  age_years: nullableNumber,
  height_cm: nullableNumber,
  weight_kg: nullableNumber,
  total_mass_kg: nullableNumber,
  fat_mass_g: nullableNumber,
  lean_mass_g: nullableNumber,
  bmc_g: nullableNumber,
  body_fat_pct: nullableNumber,
  visceral_fat_g: nullableNumber,
  android_fat_pct: nullableNumber,
  gynoid_fat_pct: nullableNumber,
  android_gynoid_ratio: nullableNumber,
  almi: nullableNumber,
  ffmi: nullableNumber,
  bone_t_score: nullableNumber,
  bone_z_score: nullableNumber,
  total_bmd: nullableNumber,
})

// Strict shape: regions must match the enum. Used to validate the reviewed
// payload on save, and as the canonical type.
export const dexaExtractionSchema = z.object({
  scan: dexaScanSchema,
  regions: z.array(dexaRegionSchema).default([]),
})

// Lenient shape for parsing raw model output: regions are unknown here and are
// validated/dropped per-item in normalizeExtraction, so one stray/unknown
// region name never fails the whole import.
export const rawExtractionSchema = z.object({
  scan: dexaScanSchema,
  regions: z.array(z.unknown()).default([]),
})

export type DexaExtraction = z.infer<typeof dexaExtractionSchema>
export type DexaScanExtract = z.infer<typeof dexaScanSchema>
export type DexaRegionExtract = z.infer<typeof dexaRegionSchema>

/**
 * Clean a parsed extraction for persistence:
 *  - drop regions that aren't a recognized region (invalid/unknown),
 *  - de-duplicate regions by name (first occurrence wins),
 *  - fill FFMI from lean+BMC+height when the report didn't print it.
 * Pure.
 */
export function normalizeExtraction(data: {
  scan: DexaScanExtract
  regions: unknown[]
}): DexaExtraction {
  const seen = new Set<string>()
  const regions: DexaRegionExtract[] = []
  for (const raw of data.regions) {
    const r = dexaRegionSchema.safeParse(raw)
    if (!r.success || seen.has(r.data.region)) continue
    seen.add(r.data.region)
    regions.push(r.data)
  }

  const scan = { ...data.scan }
  if (scan.ffmi == null) {
    scan.ffmi = deriveFfmi(scan.lean_mass_g, scan.bmc_g, scan.height_cm)
  }

  return { scan, regions }
}
