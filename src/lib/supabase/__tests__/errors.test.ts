import { describe, it, expect, vi } from 'vitest'

import { isUniqueViolation, userErrorMessage } from '../errors'

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

describe('userErrorMessage', () => {
  it('logs the raw error with its context and returns the plain message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const raw = { code: '23503', message: 'violates foreign key constraint "x_fkey"' }
    expect(userErrorMessage('deleteThing', raw, 'Could not delete. Please try again.')).toBe(
      'Could not delete. Please try again.'
    )
    expect(spy).toHaveBeenCalledWith('deleteThing failed:', raw)
    spy.mockRestore()
  })
})
