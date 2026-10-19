import { describe, it, expect } from 'vitest'
import { matchesBiomarkerQuery, type BiomarkerSearchable } from '../search'

function biomarker(over: Partial<BiomarkerSearchable> = {}): BiomarkerSearchable {
  return {
    name: 'Thyroid Stimulating Hormone',
    short_name: 'TSH',
    variant_name: null,
    aliases: ['Thyrotropin'],
    category: 'Thyroid',
    ...over,
  }
}

describe('matchesBiomarkerQuery', () => {
  it('matches a case-insensitive substring of the name', () => {
    expect(matchesBiomarkerQuery(biomarker(), 'stimulating')).toBe(true)
    expect(matchesBiomarkerQuery(biomarker(), 'THYROID STIM')).toBe(true)
  })

  it('matches the short name, aliases and category', () => {
    expect(matchesBiomarkerQuery(biomarker(), 'tsh')).toBe(true)
    expect(matchesBiomarkerQuery(biomarker(), 'thyrotrop')).toBe(true)
    expect(matchesBiomarkerQuery(biomarker({ name: 'Free T4', short_name: null, aliases: [] }), 'thyroid')).toBe(true)
  })

  it('does not match unrelated text', () => {
    expect(matchesBiomarkerQuery(biomarker(), 'ferritin')).toBe(false)
  })

  it('matches the empty query', () => {
    expect(matchesBiomarkerQuery(biomarker(), '')).toBe(true)
  })

  it('does not trim the query and does not fold diacritics', () => {
    expect(matchesBiomarkerQuery(biomarker(), ' tsh ')).toBe(true) // fields are space-joined
    expect(matchesBiomarkerQuery(biomarker(), 'tsh  ')).toBe(false)
    expect(matchesBiomarkerQuery(biomarker({ name: 'Protéine C' }), 'proteine')).toBe(false)
  })

  it('matches across field boundaries because the fields are space-joined', () => {
    // name + short_name, and alias + category, each joined by one space
    expect(matchesBiomarkerQuery(biomarker(), 'hormone tsh')).toBe(true)
    expect(matchesBiomarkerQuery(biomarker(), 'thyrotropin thyroid')).toBe(true)
  })

  it('keeps an empty slot for a missing short name (double space)', () => {
    const b = biomarker({ short_name: null })
    expect(matchesBiomarkerQuery(b, 'hormone  thyrotropin')).toBe(true)
    expect(matchesBiomarkerQuery(b, 'hormone thyrotropin')).toBe(false)
  })

  it('ignores variant_name by default', () => {
    const b = biomarker({ variant_name: 'Third generation' })
    expect(matchesBiomarkerQuery(b, 'third generation')).toBe(false)
  })

  describe('with includeVariantName', () => {
    const opts = { includeVariantName: true }

    it('matches the variant name', () => {
      const b = biomarker({ variant_name: 'Third generation' })
      expect(matchesBiomarkerQuery(b, 'third generation', opts)).toBe(true)
    })

    it('places the variant between short name and aliases', () => {
      const b = biomarker({ variant_name: 'Ultra' })
      expect(matchesBiomarkerQuery(b, 'tsh ultra thyrotropin', opts)).toBe(true)
      expect(matchesBiomarkerQuery(b, 'tsh thyrotropin', opts)).toBe(false)
    })

    it('keeps an empty slot for a missing variant name', () => {
      const b = biomarker({ variant_name: null })
      expect(matchesBiomarkerQuery(b, 'tsh  thyrotropin', opts)).toBe(true)
      expect(matchesBiomarkerQuery(b, 'tsh thyrotropin', opts)).toBe(false)
    })
  })
})
