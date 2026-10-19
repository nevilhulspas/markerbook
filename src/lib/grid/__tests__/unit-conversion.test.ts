import { describe, it, expect } from 'vitest'

import { convertValue, normalizeUnit } from '@/lib/grid/unit-conversion'
import type { BiomarkerUnit } from '@/lib/database.types'

// Minimal catalog: Hemoglobin known in g/dL (default) and g/L, but NOT mmol/L.
const hgbUnits = [
  { unit: 'g/dL', conversion_factor: 1.0, is_default: true },
  { unit: 'g/L', conversion_factor: 0.1, is_default: false },
] as unknown as BiomarkerUnit[]

describe('convertValue', () => {
  it('returns the value unchanged when the units already match', () => {
    expect(convertValue(16, 'g/dL', 'g/dL', hgbUnits)).toBe(16)
  })

  it('matches units case- and micro-sign-insensitively', () => {
    expect(normalizeUnit('µIU/mL')).toBe(normalizeUnit('uIU/ml'))
    expect(convertValue(16, 'G/DL', 'g/dl', hgbUnits)).toBe(16)
  })

  it('converts between two known units via their factors', () => {
    // 16 g/dL -> g/L: 16 * 1.0 / 0.1 = 160
    expect(convertValue(16, 'g/dL', 'g/L', hgbUnits)).toBeCloseTo(160)
    // 160 g/L -> g/dL: 160 * 0.1 / 1.0 = 16
    expect(convertValue(160, 'g/L', 'g/dL', hgbUnits)).toBeCloseTo(16)
  })

  it('returns null when the SOURCE unit has no catalog factor', () => {
    // 10.4 mmol/L Hgb is ~168 g/L, definitely not "10.4" — must refuse, not
    // silently relabel, so callers keep the original value+unit.
    expect(convertValue(10.4, 'mmol/L', 'g/L', hgbUnits)).toBeNull()
  })

  it('returns null when the TARGET unit has no catalog factor', () => {
    expect(convertValue(16, 'g/dL', 'mmol/L', hgbUnits)).toBeNull()
  })
})
