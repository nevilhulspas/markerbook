import { describe, it, expect } from 'vitest'

import { intakeSchema } from '@/lib/validations/supplement'
import { deriveFrequency } from '@/lib/supplements/intake'

describe('chat tool intake payloads', () => {
  it('accepts the shape the tools send', () => {
    expect(
      intakeSchema.safeParse({ time: '08:00', amount: '1 capsule' }).success
    ).toBe(true)
    expect(intakeSchema.safeParse({ time: '22:00' }).success).toBe(true)
  })

  it('rejects a time the model might invent', () => {
    expect(intakeSchema.safeParse({ time: 'morning' }).success).toBe(false)
    expect(intakeSchema.safeParse({ time: '8:00' }).success).toBe(false)
  })

  it('reports the derived frequency the tools return', () => {
    expect(
      deriveFrequency(
        [
          { time: '08:00', amount: '1 capsule' },
          { time: '22:00', amount: '2 capsules' },
        ],
        null
      )
    ).toBe('2x daily')
  })
})
