import { describe, it, expect } from 'vitest'

import { dexaExtractionSchema, dexaScanSchema, normalizeExtraction } from '../dexa-import'

function baseScan(overrides: Record<string, unknown> = {}) {
  return {
    scan_date: '2026-05-27',
    provider: 'DexaFit Sofia',
    age_years: 38.4, height_cm: 176, weight_kg: 87,
    total_mass_kg: 87.1, fat_mass_g: 22829, lean_mass_g: 61698, bmc_g: 2588,
    body_fat_pct: 26.2, visceral_fat_g: 1084,
    android_fat_pct: 37.1, gynoid_fat_pct: 27.3, android_gynoid_ratio: 1.34,
    almi: 9.9, ffmi: null, bone_t_score: 0.2, bone_z_score: -0.2, total_bmd: 1.224,
    ...overrides,
  }
}

describe('dexaExtractionSchema', () => {
  it('parses a valid extraction', () => {
    const r = dexaExtractionSchema.safeParse({
      scan: baseScan(),
      regions: [{ region: 'trunk', fat_pct: 33.1, fat_mass_g: 13900, lean_mass_g: 27300, bmc_g: 719, total_mass_g: 41900, bmd: null, t_score: null, z_score: null }],
    })
    expect(r.success).toBe(true)
  })

  it('rejects an unknown region', () => {
    const r = dexaExtractionSchema.safeParse({
      scan: baseScan(),
      regions: [{ region: 'forearm', fat_pct: null, fat_mass_g: null, lean_mass_g: null, bmc_g: null, total_mass_g: null, bmd: null, t_score: null, z_score: null }],
    })
    expect(r.success).toBe(false)
  })

  it('defaults missing regions to []', () => {
    const r = dexaExtractionSchema.safeParse({ scan: baseScan() })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.regions).toEqual([])
  })

  it('tolerates omitted optional fields (model omits unknowns) → null', () => {
    // Only scan_date present; everything else omitted, as the json_schema now allows.
    const r = dexaExtractionSchema.safeParse({
      scan: { scan_date: '2026-05-27' },
      regions: [{ region: 'total' }],
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.scan.body_fat_pct).toBeNull()
      expect(r.data.scan.provider).toBeNull()
      expect(r.data.regions[0].fat_pct).toBeNull()
      expect(r.data.regions[0].region).toBe('total')
    }
  })
})

describe('normalizeExtraction', () => {
  it('fills FFMI from lean+bmc+height when absent', () => {
    const parsed = dexaExtractionSchema.parse({ scan: baseScan({ ffmi: null }), regions: [] })
    const out = normalizeExtraction(parsed)
    // (61698 + 2588)/1000 / 1.76^2 ≈ 20.76
    expect(out.scan.ffmi).toBeCloseTo(20.76, 1)
  })

  it('keeps a provided FFMI', () => {
    const parsed = dexaExtractionSchema.parse({ scan: baseScan({ ffmi: 20.8 }), regions: [] })
    expect(normalizeExtraction(parsed).scan.ffmi).toBe(20.8)
  })

  it('drops unknown/invalid regions but keeps valid ones (never fails the import)', () => {
    const out = normalizeExtraction({
      scan: dexaScanSchema.parse(baseScan()),
      regions: [
        { region: 'trunk_left', lean_mass_g: 13400 },
        { region: 'forearm', fat_pct: 10 }, // unknown region → dropped
        { nonsense: true }, // not a region → dropped
      ],
    })
    expect(out.regions.map((r) => r.region)).toEqual(['trunk_left'])
  })

  it('de-duplicates regions by name (first wins)', () => {
    const parsed = dexaExtractionSchema.parse({
      scan: baseScan(),
      regions: [
        { region: 'arms', fat_pct: 22.2, fat_mass_g: 2260, lean_mass_g: 7590, bmc_g: 349, total_mass_g: 10200, bmd: null, t_score: null, z_score: null },
        { region: 'arms', fat_pct: 99, fat_mass_g: null, lean_mass_g: null, bmc_g: null, total_mass_g: null, bmd: null, t_score: null, z_score: null },
      ],
    })
    const out = normalizeExtraction(parsed)
    expect(out.regions).toHaveLength(1)
    expect(out.regions[0].fat_pct).toBe(22.2)
  })
})
