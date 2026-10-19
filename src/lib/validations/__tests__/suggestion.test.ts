import { describe, it, expect } from 'vitest'
import { suggestionSchema, BIOMARKER_CATEGORIES } from '../suggestion'

describe('BIOMARKER_CATEGORIES', () => {
  it('has exactly 15 items matching the canonical list', () => {
    expect(BIOMARKER_CATEGORIES).toHaveLength(15)
    expect(BIOMARKER_CATEGORIES).toEqual([
      'Hematology',
      'Metabolic',
      'Lipid Panel',
      'Liver',
      'Kidney',
      'Thyroid',
      'Vitamins & Minerals',
      'Hormones',
      'Inflammation',
      'Cardiac',
      'Diabetes',
      'Electrolytes',
      'Iron Studies',
      'Immune',
      'Other',
    ])
  })
})

describe('suggestionSchema', () => {
  it('accepts valid marker suggestion with name, category, and details', () => {
    const result = suggestionSchema.safeParse({
      type: 'marker',
      name: 'Cortisol',
      category: 'Hormones',
      details: 'Morning cortisol test',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid marker suggestion without details (details is optional)', () => {
    const result = suggestionSchema.safeParse({
      type: 'marker',
      name: 'DHEA-S',
      category: 'Hormones',
    })
    expect(result.success).toBe(true)
  })

  it('rejects marker suggestion without category', () => {
    const result = suggestionSchema.safeParse({
      type: 'marker',
      name: 'Cortisol',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain('Category is required for marker suggestions')
    }
  })

  it('accepts unit suggestion without category (category only required for marker type)', () => {
    const result = suggestionSchema.safeParse({
      type: 'unit',
      name: 'pmol/L',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name with "Name is required"', () => {
    const result = suggestionSchema.safeParse({
      type: 'marker',
      name: '',
      category: 'Hormones',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain('Name is required')
    }
  })

  it('rejects name over 200 characters', () => {
    const result = suggestionSchema.safeParse({
      type: 'marker',
      name: 'A'.repeat(201),
      category: 'Other',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('200'))).toBe(true)
    }
  })

  it('rejects details over 1000 characters', () => {
    const result = suggestionSchema.safeParse({
      type: 'marker',
      name: 'Valid Name',
      category: 'Other',
      details: 'A'.repeat(1001),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('1000'))).toBe(true)
    }
  })

  it('rejects invalid type value', () => {
    const result = suggestionSchema.safeParse({
      type: 'invalid',
      name: 'Test',
      category: 'Other',
    })
    expect(result.success).toBe(false)
  })

  it('trims whitespace from name', () => {
    const result = suggestionSchema.safeParse({
      type: 'marker',
      name: '  Cortisol  ',
      category: 'Hormones',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Cortisol')
    }
  })
})
