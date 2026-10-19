import { describe, it, expect } from 'vitest'
import { markerEntrySchema } from '../blood-test'

const UUID = '11111111-1111-4111-8111-111111111111'

describe('markerEntrySchema — marker identity (exactly one of three)', () => {
  it('accepts an existing biomarker_id', () => {
    expect(markerEntrySchema.safeParse({ biomarker_id: UUID, value: 1, unit: 'ng/mL' }).success).toBe(true)
  })

  it('accepts a capture_loinc_code', () => {
    expect(markerEntrySchema.safeParse({ capture_loinc_code: '2276-4', value: 1, unit: 'ng/mL' }).success).toBe(true)
  })

  it('accepts a capture_custom entry with a name', () => {
    const r = markerEntrySchema.safeParse({ capture_custom: true, name: 'AA/EPA', value: 16.38, unit: 'ratio' })
    expect(r.success).toBe(true)
  })

  it('rejects a capture_custom entry with no name', () => {
    const r = markerEntrySchema.safeParse({ capture_custom: true, value: 16.38, unit: 'ratio' })
    expect(r.success).toBe(false)
  })

  it('rejects a capture_custom entry with a blank name', () => {
    const r = markerEntrySchema.safeParse({ capture_custom: true, name: '   ', value: 16.38, unit: 'ratio' })
    expect(r.success).toBe(false)
  })

  it('rejects providing two identities at once', () => {
    const r = markerEntrySchema.safeParse({ biomarker_id: UUID, capture_custom: true, name: 'x', value: 1, unit: 'ratio' })
    expect(r.success).toBe(false)
  })

  it('rejects providing none of the three identities', () => {
    expect(markerEntrySchema.safeParse({ value: 1, unit: 'ratio' }).success).toBe(false)
  })
})
