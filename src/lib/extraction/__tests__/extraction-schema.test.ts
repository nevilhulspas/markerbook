import { describe, it, expect } from 'vitest'
import { extractedMarkerSchema } from '@/lib/validations/pdf-import'

describe('extractedMarkerSchema', () => {
  it('accepts an optional loinc_code and printed reference range', () => {
    const r = extractedMarkerSchema.parse({
      name: 'Soluble transferrin receptor', value: 1.2, unit: 'mg/L',
      confidence: 'high', catalog_match: null,
      loinc_code: '30248-9', ref_range_low: 0.8, ref_range_high: 1.8,
    })
    expect(r.loinc_code).toBe('30248-9')
    expect(r.ref_range_low).toBe(0.8)
  })
  it('still accepts a marker with neither (older shape)', () => {
    const r = extractedMarkerSchema.parse({
      name: 'Glucose', value: 5, unit: 'mmol/L', confidence: 'high', catalog_match: 'Glucose',
    })
    expect(r.loinc_code ?? null).toBeNull()
  })
})
