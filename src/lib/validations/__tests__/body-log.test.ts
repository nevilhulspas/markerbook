import { describe, it, expect } from 'vitest'

import { bodyLogEntrySchema } from '../body-log'

describe('bodyLogEntrySchema', () => {
  it('accepts an entry with at least one metric', () => {
    expect(bodyLogEntrySchema.safeParse({ logged_on: '2026-05-27', weight_kg: 87 }).success).toBe(true)
    expect(bodyLogEntrySchema.safeParse({ logged_on: '2026-05-27', waist_cm: 84 }).success).toBe(true)
  })

  it('rejects an entry with no metrics', () => {
    expect(bodyLogEntrySchema.safeParse({ logged_on: '2026-05-27' }).success).toBe(false)
    expect(
      bodyLogEntrySchema.safeParse({ logged_on: '2026-05-27', weight_kg: null, body_fat_pct: null, waist_cm: null }).success
    ).toBe(false)
  })

  it('requires a date', () => {
    expect(bodyLogEntrySchema.safeParse({ weight_kg: 87 }).success).toBe(false)
  })

  it('rejects an out-of-range body-fat %', () => {
    expect(bodyLogEntrySchema.safeParse({ logged_on: '2026-05-27', body_fat_pct: 150 }).success).toBe(false)
  })
})
