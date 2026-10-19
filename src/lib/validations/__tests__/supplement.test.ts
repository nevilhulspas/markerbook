import { describe, it, expect } from 'vitest'

import { createSupplementSchema } from '@/lib/validations/supplement'

const base = { name: 'Magnesium', start_date: '2026-08-16' }

describe('createSupplementSchema intakes', () => {
  it('accepts a supplement with no intakes', () => {
    expect(createSupplementSchema.safeParse(base).success).toBe(true)
  })

  it('accepts a split intake', () => {
    const r = createSupplementSchema.safeParse({
      ...base,
      intakes: [
        { time: '08:00', amount: '1 capsule' },
        { time: '22:00', amount: '2 capsules' },
      ],
    })
    expect(r.success).toBe(true)
  })

  it('rejects a malformed time', () => {
    const r = createSupplementSchema.safeParse({
      ...base,
      intakes: [{ time: '8am' }],
    })
    expect(r.success).toBe(false)
  })

  it('rejects an out-of-range time', () => {
    expect(
      createSupplementSchema.safeParse({ ...base, intakes: [{ time: '24:00' }] })
        .success
    ).toBe(false)
    expect(
      createSupplementSchema.safeParse({ ...base, intakes: [{ time: '08:60' }] })
        .success
    ).toBe(false)
  })

  it('rejects duplicate times', () => {
    const r = createSupplementSchema.safeParse({
      ...base,
      intakes: [{ time: '08:00' }, { time: '08:00' }],
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/same time twice/i)
    }
  })

  it('rejects more than 12 moments', () => {
    const intakes = Array.from({ length: 13 }, (_, i) => ({
      time: `${String(i).padStart(2, '0')}:00`,
    }))
    expect(createSupplementSchema.safeParse({ ...base, intakes }).success).toBe(
      false
    )
  })
})
