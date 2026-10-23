import { describe, it, expect } from 'vitest'
import { formatQualified, normalizeQualifier, parseQualifiedValue } from '../qualifier'

describe('result qualifiers (regression: "<0.5" was stored as a plain 0.5)', () => {
  it('parses typed values with and without a qualifier', () => {
    expect(parseQualifiedValue('<0.5')).toEqual({ value: 0.5, qualifier: '<' })
    expect(parseQualifiedValue('> 100')).toEqual({ value: 100, qualifier: '>' })
    expect(parseQualifiedValue('≤3')).toEqual({ value: 3, qualifier: '<=' })
    expect(parseQualifiedValue('-1.5')).toEqual({ value: -1.5, qualifier: null })
    expect(parseQualifiedValue('0')).toEqual({ value: 0, qualifier: null })
    expect(parseQualifiedValue('0,8')).toEqual({ value: 0.8, qualifier: null })
  })

  it('rejects text without a number', () => {
    expect(parseQualifiedValue('')).toBeNull()
    expect(parseQualifiedValue('<')).toBeNull()
    expect(parseQualifiedValue('negative')).toBeNull()
  })

  it('normalizes spellings and formats for display', () => {
    expect(normalizeQualifier('≥')).toBe('>=')
    expect(normalizeQualifier('~')).toBeNull()
    expect(formatQualified('0.5', '<')).toBe('<0.5')
    expect(formatQualified('3', '<=')).toBe('≤3')
    expect(formatQualified('3', null)).toBe('3')
  })
})
