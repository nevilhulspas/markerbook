import { describe, it, expect } from 'vitest'

import { parseUnit, sameUnit } from '@/lib/units/parse'
import {
  convertUnit,
  formatUnitValue,
  inputUnitOptions,
  isConvertible,
  storageSpelling,
  toDisplay,
  type MarkerUnits,
} from '@/lib/units/convert'

const vitaminD: MarkerUnits = {
  catalogueUnit: 'ng/mL',
  factors: [
    { unit: 'ng/mL', conversion_factor: 1 },
    { unit: 'nmol/L', conversion_factor: 0.4006 },
  ],
}
const hemoglobin: MarkerUnits = {
  catalogueUnit: 'g/dL',
  factors: [
    { unit: 'g/dL', conversion_factor: 1 },
    { unit: 'g/L', conversion_factor: 0.1 },
  ],
}
const ferritin: MarkerUnits = { catalogueUnit: 'ng/mL', factors: [{ unit: 'ng/mL', conversion_factor: 1 }] }
const hba1c: MarkerUnits = { catalogueUnit: '%', factors: [], loincCode: '4548-4', name: 'HbA1c' }
const lymphocytes: MarkerUnits = { catalogueUnit: '%', factors: [{ unit: '%', conversion_factor: 1 }] }

const near = (a: number | null, b: number, tol = 1e-3) => {
  expect(a).not.toBeNull()
  expect(Math.abs((a as number) - b)).toBeLessThan(tol)
}

describe('parseUnit / sameUnit', () => {
  it('treats spelling variants as one unit', () => {
    expect(sameUnit('µmol/L', 'umol/l')).toBe(true)
    expect(sameUnit('μmol/l', 'micromol/l')).toBe(true)
    expect(sameUnit('mmol/l', 'mmol/L')).toBe(true)
    expect(sameUnit('mm/uur', 'mm/hr')).toBe(true)
    expect(sameUnit('ml/min/1.73m²', 'mL/min/1.73m2')).toBe(true)
  })

  it('treats equal-scale units of one kind as the same unit', () => {
    expect(sameUnit('ug/l', 'ng/mL')).toBe(true)
    expect(sameUnit('IU/L', 'mIU/mL')).toBe(true)
    expect(sameUnit('mU/l', 'uIU/mL')).toBe(true)
    expect(sameUnit('mE/l', 'mIU/L')).toBe(true)
    expect(sameUnit('10^9/l', 'x10^3/uL')).toBe(true)
    expect(sameUnit('G/l', '10^9/L')).toBe(true)
    expect(sameUnit('/nl', 'x10^3/µL')).toBe(true)
    expect(sameUnit('T/l', 'x10^6/uL')).toBe(true)
    expect(sameUnit('10⁶/µL', 'x10^6/uL')).toBe(true)
  })

  it('keeps grams and giga apart', () => {
    expect(parseUnit('g/L').kind).toBe('mass')
    expect(parseUnit('G/l').kind).toBe('count')
  })

  it('does not equate different kinds', () => {
    expect(sameUnit('%', '10^9/l')).toBe(false)
    expect(sameUnit('mmol/mol', '%')).toBe(false)
    expect(sameUnit('ml/min', 'ml/min/1.73m2')).toBe(false)
  })
})

describe('convertUnit', () => {
  it('converts by prefix without any table', () => {
    near(convertUnit(145, 'g/L', 'g/dL'), 14.5)
    near(convertUnit(82, 'µg/L', 'ng/mL'), 82)
    near(convertUnit(0.45, 'L/L', '%'), 45)
    near(convertUnit(6.5, 'G/l', 'x10^3/uL'), 6.5)
  })

  it('converts mass ↔ amount through the marker factor, both directions', () => {
    near(convertUnit(75, 'nmol/L', 'ng/mL', vitaminD), 30.045)
    near(convertUnit(30, 'ng/mL', 'nmol/L', vitaminD), 74.888, 1e-2)
    // a prefix variant of a catalogue unit still works (µg/L = ng/mL)
    near(convertUnit(30, 'ug/l', 'nmol/L', vitaminD), 74.888, 1e-2)
  })

  it('converts HbA1c between IFCC mmol/mol and NGSP % with the master equation', () => {
    near(convertUnit(36, 'mmol/mol', '%', hba1c), 5.445, 1e-3)
    near(convertUnit(5.445, '%', 'mmol/mol', hba1c), 36, 1e-2)
  })

  it('returns null instead of guessing', () => {
    expect(convertUnit(9, 'mmol/L', 'g/dL', hemoglobin)).toBeNull()
    expect(convertUnit(2.1, '10^9/l', '%', lymphocytes)).toBeNull()
    expect(convertUnit(36, 'mmol/mol', '%')).toBeNull()
    expect(convertUnit(50, 'pmol/L', 'ng/mL', ferritin)).toBeNull()
  })
})

describe('toDisplay', () => {
  it('converts to the display unit when possible', () => {
    const d = toDisplay(75, 'nmol/L', 'ng/mL', vitaminD)
    expect(d.inDisplayUnit).toBe(true)
    expect(d.unit).toBe('ng/mL')
    near(d.value, 30.045)
  })

  it('keeps the value in its own unit when not convertible, never relabelled', () => {
    expect(toDisplay(9, 'mmol/L', 'g/dL', hemoglobin)).toEqual({ value: 9, unit: 'mmol/L', inDisplayUnit: false })
  })
})

describe('input helpers', () => {
  it('stores the catalogue spelling of the same unit, never a converted value', () => {
    expect(storageSpelling(' nmol/l ', vitaminD)).toBe('nmol/L')
    expect(storageSpelling('IU/l', vitaminD)).toBe('IU/l')
  })

  it('offers the marker units plus an extracted one once', () => {
    expect(inputUnitOptions(vitaminD, 'nmol/l')).toEqual(['ng/mL', 'nmol/L'])
    expect(inputUnitOptions(ferritin, 'µg/L')).toEqual(['ng/mL'])
    expect(inputUnitOptions(ferritin, 'pmol/L')).toEqual(['ng/mL', 'pmol/L'])
  })

  it('knows which units a marker can convert', () => {
    expect(isConvertible('µg/L', ferritin)).toBe(true)
    expect(isConvertible('pmol/L', ferritin)).toBe(false)
  })
})

describe('formatUnitValue', () => {
  it('keeps small values readable and large ones clean', () => {
    expect(formatUnitValue(0.035)).toBe('0.035')
    expect(formatUnitValue(0.905)).toBe('0.905')
    expect(formatUnitValue(14.53)).toBe('14.5')
    expect(formatUnitValue(5.445)).toBe('5.45')
    expect(formatUnitValue(245.6)).toBe('246')
    expect(formatUnitValue(12000.4)).toBe('12000')
  })
})
