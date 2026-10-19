import { describe, it, expect } from 'vitest'
import { labTestSuggestionSchema } from '@/lib/validations/lab-test-suggestion'

const LAB_ID = '11111111-1111-4111-8111-111111111111'

describe('labTestSuggestionSchema', () => {
  it('accepts a valid uuid + https url', () => {
    const r = labTestSuggestionSchema.safeParse({
      labId: LAB_ID,
      url: 'https://bodimed.com/produkt/reverse-t3/',
    })
    expect(r.success).toBe(true)
  })

  it('rejects a non-uuid labId', () => {
    const r = labTestSuggestionSchema.safeParse({ labId: 'nope', url: 'https://x.com' })
    expect(r.success).toBe(false)
  })

  it('rejects a non-http(s) url', () => {
    const r = labTestSuggestionSchema.safeParse({ labId: LAB_ID, url: 'ftp://x.com/a' })
    expect(r.success).toBe(false)
  })

  it('rejects a missing url', () => {
    const r = labTestSuggestionSchema.safeParse({ labId: LAB_ID })
    expect(r.success).toBe(false)
  })
})
