import { describe, it, expect } from 'vitest'

import { isUniqueViolation } from '../errors'

describe('isUniqueViolation', () => {
  it('is true for a Postgres 23505 error', () => {
    expect(isUniqueViolation({ code: '23505', message: 'duplicate key' })).toBe(true)
  })

  it('is false for other error codes', () => {
    expect(isUniqueViolation({ code: '23503', message: 'fk violation' })).toBe(false)
    expect(isUniqueViolation({ message: 'no code' })).toBe(false)
  })

  it('is false for null / undefined / non-objects', () => {
    expect(isUniqueViolation(null)).toBe(false)
    expect(isUniqueViolation(undefined)).toBe(false)
    expect(isUniqueViolation('23505')).toBe(false)
  })
})
