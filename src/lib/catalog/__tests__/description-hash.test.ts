import { describe, it, expect } from 'vitest'
import { hashBiomarkerContext } from '../description-hash'

describe('hashBiomarkerContext', () => {
  const baseInput = {
    name: 'HbA1c',
    category: 'Diabetes',
    unit: '%',
    referenceRanges: [
      { sex: 'all', range_low: 4, range_high: 5.6, range_type: 'normal' },
    ],
    panelName: 'Metabolic',
    systemName: 'Endocrine',
  }

  it('returns a consistent hash for the same input', () => {
    const hash1 = hashBiomarkerContext(baseInput)
    const hash2 = hashBiomarkerContext(baseInput)
    expect(hash1).toBe(hash2)
    expect(typeof hash1).toBe('string')
    expect(hash1.length).toBeGreaterThan(0)
  })

  it('returns a different hash when referenceRanges change', () => {
    const modified = {
      ...baseInput,
      referenceRanges: [
        { sex: 'all', range_low: 4, range_high: 6.0, range_type: 'normal' },
      ],
    }
    expect(hashBiomarkerContext(baseInput)).not.toBe(
      hashBiomarkerContext(modified)
    )
  })

  it('returns the same hash regardless of referenceRanges order', () => {
    const input1 = {
      ...baseInput,
      referenceRanges: [
        { sex: 'male', range_low: 4, range_high: 5.6, range_type: 'normal' },
        {
          sex: 'female',
          range_low: 4,
          range_high: 5.4,
          range_type: 'normal',
        },
      ],
    }
    const input2 = {
      ...baseInput,
      referenceRanges: [
        {
          sex: 'female',
          range_low: 4,
          range_high: 5.4,
          range_type: 'normal',
        },
        { sex: 'male', range_low: 4, range_high: 5.6, range_type: 'normal' },
      ],
    }
    expect(hashBiomarkerContext(input1)).toBe(hashBiomarkerContext(input2))
  })

  it('returns a different hash when name changes', () => {
    const modified = { ...baseInput, name: 'Glucose' }
    expect(hashBiomarkerContext(baseInput)).not.toBe(
      hashBiomarkerContext(modified)
    )
  })

  it('handles null panelName and systemName', () => {
    const withNulls = {
      ...baseInput,
      panelName: null,
      systemName: null,
    }
    const hash = hashBiomarkerContext(withNulls)
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
    // Should differ from input with non-null values
    expect(hash).not.toBe(hashBiomarkerContext(baseInput))
  })

  it('returns a different hash when referenceRanges have null range values', () => {
    const withNullRanges = {
      ...baseInput,
      referenceRanges: [
        { sex: 'all', range_low: null, range_high: null, range_type: 'normal' },
      ],
    }
    expect(hashBiomarkerContext(baseInput)).not.toBe(
      hashBiomarkerContext(withNullRanges)
    )
  })
})
