import { describe, it, expect } from 'vitest'

import { needsTranslation, parseTranslationArray } from '../translate'

describe('needsTranslation', () => {
  it('flags non-Latin scripts', () => {
    expect(needsTranslation('Креатинин')).toBe(true) // Bulgarian
    expect(needsTranslation('Кръвна захар (глюкоза)')).toBe(true)
    expect(needsTranslation('λευκοκύτταρα')).toBe(true) // Greek
  })

  it('leaves Latin (incl. accented) text untouched', () => {
    expect(needsTranslation('Creatinine')).toBe(false)
    expect(needsTranslation('blood')).toBe(false)
    expect(needsTranslation('CA 19-9')).toBe(false)
    expect(needsTranslation('Café au lait')).toBe(false) // accented Latin
    expect(needsTranslation('Großes Blutbild')).toBe(false) // German ß
    expect(needsTranslation('')).toBe(false)
  })
})

describe('parseTranslationArray', () => {
  it('parses a clean same-length array', () => {
    expect(parseTranslationArray('["Creatinine","Glucose"]', 2)).toEqual([
      'Creatinine',
      'Glucose',
    ])
  })

  it('tolerates code fences and surrounding prose', () => {
    const reply = 'Here you go:\n```json\n["Creatinine", "Glucose"]\n```'
    expect(parseTranslationArray(reply, 2)).toEqual(['Creatinine', 'Glucose'])
  })

  it('rejects a length mismatch', () => {
    expect(parseTranslationArray('["Creatinine"]', 2)).toBeNull()
  })

  it('rejects non-string elements', () => {
    expect(parseTranslationArray('["Creatinine", 5]', 2)).toBeNull()
  })

  it('returns null when no array is present', () => {
    expect(parseTranslationArray('not json at all', 1)).toBeNull()
  })

  it('handles strings containing brackets without unbalancing', () => {
    expect(parseTranslationArray('["IgG (anti-Measles)"]', 1)).toEqual([
      'IgG (anti-Measles)',
    ])
  })
})
