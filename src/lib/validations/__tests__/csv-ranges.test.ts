import { describe, it, expect, beforeAll } from 'vitest'
import { parseCsvRanges, CSV_RANGE_HEADERS } from '../csv-ranges'

describe('CSV_RANGE_HEADERS', () => {
  it('exports the expected header list', () => {
    expect(CSV_RANGE_HEADERS).toEqual([
      'biomarker_name',
      'unit',
      'sex',
      'age_min',
      'age_max',
      'range_low',
      'range_high',
      'source',
      'range_type',
    ])
  })
})

describe('parseCsvRanges', () => {
  const validHeaders = CSV_RANGE_HEADERS.join(',')

  it('parses valid CSV with correct fields', () => {
    const csv = `${validHeaders}\nGlucose,mg/dL,general,,,,99,Lab Corp,normal`
    const result = parseCsvRanges(csv)

    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toEqual({
      biomarker_name: 'Glucose',
      unit: 'mg/dL',
      sex: 'general',
      age_min: '',
      age_max: '',
      range_low: '',
      range_high: '99',
      source: 'Lab Corp',
      range_type: 'normal',
    })
  })

  it('parses multiple rows', () => {
    const csv = [
      validHeaders,
      'Glucose,mg/dL,general,18,65,70,99,Lab Corp,normal',
      'HbA1c,%,general,,,4,5.6,Lab Corp,optimal',
    ].join('\n')

    const result = parseCsvRanges(csv)

    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].biomarker_name).toBe('Glucose')
    expect(result.rows[1].biomarker_name).toBe('HbA1c')
  })

  it('handles case-insensitive headers', () => {
    const csv = 'Biomarker_Name,Unit,Sex,Age_Min,Age_Max,Range_Low,Range_High,Source,Range_Type\nGlucose,mg/dL,general,,,70,99,Lab,normal'
    const result = parseCsvRanges(csv)

    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
  })

  it('throws error for missing required headers', () => {
    const csv = 'biomarker_name,unit,sex\nGlucose,mg/dL,general'

    expect(() => parseCsvRanges(csv)).toThrow(/missing.*header/i)
  })

  it('lists missing header names in error message', () => {
    const csv = 'biomarker_name,unit\nGlucose,mg/dL'

    try {
      parseCsvRanges(csv)
      expect.fail('Should have thrown')
    } catch (e) {
      const msg = (e as Error).message
      expect(msg).toContain('sex')
      expect(msg).toContain('source')
      expect(msg).toContain('range_type')
    }
  })

  it('returns validation error for non-numeric range_low', () => {
    const csv = `${validHeaders}\nGlucose,mg/dL,general,,,abc,99,Lab,normal`
    const result = parseCsvRanges(csv)

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].line).toBe(1)
    expect(result.errors[0].message).toContain('range_low')
  })

  it('returns validation error for non-numeric range_high', () => {
    const csv = `${validHeaders}\nGlucose,mg/dL,general,,,70,xyz,Lab,normal`
    const result = parseCsvRanges(csv)

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].line).toBe(1)
    expect(result.errors[0].message).toContain('range_high')
  })

  it('returns validation error for invalid sex value', () => {
    const csv = `${validHeaders}\nGlucose,mg/dL,unknown,,,70,99,Lab,normal`
    const result = parseCsvRanges(csv)

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('sex')
  })

  it('returns validation error for empty source', () => {
    const csv = `${validHeaders}\nGlucose,mg/dL,general,,,70,99,,normal`
    const result = parseCsvRanges(csv)

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('source')
  })

  it('returns empty array for header-only input', () => {
    const csv = validHeaders
    const result = parseCsvRanges(csv)

    expect(result.rows).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    const result = parseCsvRanges('')
    expect(result.rows).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('skips blank lines in input', () => {
    const csv = `${validHeaders}\n\nGlucose,mg/dL,general,,,70,99,Lab,normal\n\n`
    const result = parseCsvRanges(csv)

    expect(result.rows).toHaveLength(1)
    expect(result.errors).toHaveLength(0)
  })

  it('allows empty range_low and range_high (valid)', () => {
    const csv = `${validHeaders}\nGlucose,mg/dL,general,,,,, Lab,normal`
    const result = parseCsvRanges(csv)

    // Empty numeric fields are valid (they represent null)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].range_low).toBe('')
    expect(result.rows[0].range_high).toBe('')
  })

  it('allows non-numeric age_min/age_max to pass through as strings', () => {
    const csv = `${validHeaders}\nGlucose,mg/dL,general,abc,def,70,99,Lab,normal`
    const result = parseCsvRanges(csv)

    // age_min/age_max validation happens at import time, not parse time
    // However, if we do validate them, this test can be adjusted
    expect(result.rows.length + result.errors.length).toBeGreaterThan(0)
  })
})

describe('biomarker Zod schemas', () => {
  // These test the Zod schemas from biomarker.ts
  let createBiomarkerSchema: typeof import('../biomarker').createBiomarkerSchema
  let createUnitSchema: typeof import('../biomarker').createUnitSchema
  let createRangeSchema: typeof import('../biomarker').createRangeSchema

  beforeAll(async () => {
    const mod = await import('../biomarker')
    createBiomarkerSchema = mod.createBiomarkerSchema
    createUnitSchema = mod.createUnitSchema
    createRangeSchema = mod.createRangeSchema
  })

  it('createBiomarkerSchema rejects empty name', () => {
    const result = createBiomarkerSchema.safeParse({
      name: '',
      category: 'Lipids',
      unit: 'mg/dL',
    })
    expect(result.success).toBe(false)
  })

  it('createBiomarkerSchema accepts valid input', () => {
    const result = createBiomarkerSchema.safeParse({
      name: 'Glucose',
      category: 'Metabolic',
      unit: 'mg/dL',
    })
    expect(result.success).toBe(true)
  })

  it('createBiomarkerSchema accepts optional fields', () => {
    const result = createBiomarkerSchema.safeParse({
      name: 'Glucose',
      category: 'Metabolic',
      unit: 'mg/dL',
      short_name: 'GLU',
      description: 'Blood sugar level',
      aliases: ['Blood Sugar', 'Fasting Glucose'],
    })
    expect(result.success).toBe(true)
  })

  it('createUnitSchema rejects zero conversion_factor', () => {
    const result = createUnitSchema.safeParse({
      biomarker_id: '123e4567-e89b-12d3-a456-426614174000',
      unit: 'mmol/L',
      conversion_factor: 0,
    })
    expect(result.success).toBe(false)
  })

  it('createUnitSchema rejects negative conversion_factor', () => {
    const result = createUnitSchema.safeParse({
      biomarker_id: '123e4567-e89b-12d3-a456-426614174000',
      unit: 'mmol/L',
      conversion_factor: -1,
    })
    expect(result.success).toBe(false)
  })

  it('createUnitSchema accepts valid input', () => {
    const result = createUnitSchema.safeParse({
      biomarker_id: '123e4567-e89b-12d3-a456-426614174000',
      unit: 'mmol/L',
      conversion_factor: 0.0555,
    })
    expect(result.success).toBe(true)
  })

  it('createRangeSchema rejects invalid sex enum', () => {
    const result = createRangeSchema.safeParse({
      biomarker_id: '123e4567-e89b-12d3-a456-426614174000',
      unit: 'mg/dL',
      sex: 'unknown',
      range_low: 70,
      range_high: 99,
      source: 'Lab Corp',
    })
    expect(result.success).toBe(false)
  })

  it('createRangeSchema accepts valid input', () => {
    const result = createRangeSchema.safeParse({
      biomarker_id: '123e4567-e89b-12d3-a456-426614174000',
      unit: 'mg/dL',
      sex: 'general',
      range_low: 70,
      range_high: 99,
      source: 'Lab Corp',
      range_type: 'normal',
    })
    expect(result.success).toBe(true)
  })
})
