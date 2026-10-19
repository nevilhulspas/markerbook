import { describe, it, expect } from 'vitest'

import { rmrExtractionSchema } from '@/lib/validations/rmr-import'

describe('rmrExtractionSchema', () => {
  it('accepts a full extraction', () => {
    const r = rmrExtractionSchema.safeParse({
      test: {
        test_date: '2026-05-27',
        provider: 'Dexafit Sofia',
        rmr_kcal: 2229,
        predicted_rmr_kcal: 1887,
        rer: 0.99,
        fuel_carb_pct: 97,
        fuel_fat_pct: 3,
      },
    })
    expect(r.success).toBe(true)
  })

  it('defaults optionals to null and requires rmr_kcal', () => {
    const r = rmrExtractionSchema.safeParse({
      test: { test_date: '2026-05-27', rmr_kcal: 2000 },
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.test.predicted_rmr_kcal).toBeNull()

    const bad = rmrExtractionSchema.safeParse({ test: { test_date: '2026-05-27' } })
    expect(bad.success).toBe(false)
  })
})
