import { describe, it, expect } from 'vitest'

import type { Biomarker, ReferenceRange } from '@/lib/database.types'
import { describeResult, markerUnitsFor, resolveResultRange } from '@/lib/units/result-range'

const vitD = {
  id: 'b1',
  name: 'Vitamin D (25-OH)',
  unit: 'ng/mL',
  loinc_code: null,
  ref_range_low: 30,
  ref_range_high: 100,
  ref_range_low_male: null,
  ref_range_high_male: null,
  ref_range_low_female: null,
  ref_range_high_female: null,
} as unknown as Biomarker

const marker = markerUnitsFor(vitD, [
  { unit: 'ng/mL', conversion_factor: 1 },
  { unit: 'nmol/L', conversion_factor: 0.4006 },
])

const range = (unit: string, low: number, high: number): ReferenceRange =>
  ({ biomarker_id: 'b1', unit, range_low: low, range_high: high, sex: 'general', range_type: 'normal', phase: null, age_min: null, age_max: null }) as unknown as ReferenceRange

describe('resolveResultRange', () => {
  it('compares a value against a range in another unit by converting', () => {
    // 50 nmol/L ≈ 20 ng/mL: below a 30–100 ng/mL range
    const r = resolveResultRange(50, 'nmol/L', vitD, [range('ng/mL', 30, 100)], marker)
    expect(r.unit).toBe('ng/mL')
    expect(r.status).toBe('out-of-range')
  })

  it('matches a range by spelling variant without conversion', () => {
    const r = resolveResultRange(40, 'ug/l', vitD, [range('ng/mL', 30, 100)], marker)
    expect(r.status).toBe('normal')
  })

  it('is unknown when no range unit is reachable', () => {
    const r = resolveResultRange(9, 'IU/L', vitD, [range('ng/mL', 30, 100)], marker)
    expect(r.status).toBe('unknown')
  })

  it('uses the inline range in the catalogue unit when there are no ranges', () => {
    const r = resolveResultRange(100, 'nmol/L', vitD, [], marker)
    expect(r.status).toBe('normal')
  })
})

describe('describeResult', () => {
  it('shows the value and the range in the display unit and keeps the entered value', () => {
    const d = describeResult(75, 'nmol/L', vitD, [range('ng/mL', 30, 100)], marker, 'ng/mL')
    expect(d.shown.unit).toBe('ng/mL')
    expect(d.shown.value).toBeCloseTo(30.045, 3)
    expect(d.entered).toEqual({ value: 75, unit: 'nmol/L' })
    expect(d.rangeShown.unit).toBe('ng/mL')
    expect(d.range.status).toBe('normal')
  })

  it('keeps a value that cannot be converted in its own unit', () => {
    const d = describeResult(9, 'IU/L', vitD, [range('ng/mL', 30, 100)], marker, 'ng/mL')
    expect(d.shown).toEqual({ value: 9, unit: 'IU/L', inDisplayUnit: false })
  })
})

describe('markers with a molar mass', () => {
  const cortisol = {
    ...vitD,
    name: 'Cortisol',
    unit: 'ug/dL',
    molar_mass: 362.466,
    valence: null,
    typical_mass_unit: 'ug/dL',
    typical_molar_unit: 'nmol/L',
  } as unknown as Biomarker

  it('offers the typical molar unit and converts to it without a factor row', () => {
    const m = markerUnitsFor(cortisol, [])
    expect(m.typicalUnits).toEqual(['ug/dL', 'nmol/L'])
    const d = describeResult(276, 'nmol/L', cortisol, [range('ug/dL', 5, 25)], m, 'ug/dL')
    expect(d.shown.unit).toBe('ug/dL')
    expect(d.shown.value).toBeCloseTo(10.0, 1)
    expect(d.range.status).toBe('normal')
  })

  it('adds mEq/L for an ion', () => {
    const calcium = { ...cortisol, molar_mass: 40.078, valence: 2, typical_mass_unit: 'mg/dL', typical_molar_unit: 'mmol/L' } as unknown as Biomarker
    expect(markerUnitsFor(calcium, []).typicalUnits).toEqual(['mg/dL', 'mmol/L', 'mEq/L'])
  })
})
