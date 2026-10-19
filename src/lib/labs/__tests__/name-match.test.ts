import { describe, it, expect } from 'vitest'

import { firstLab, preferSampleType, resolveBestMatch, scoreNameMatch } from '@/lib/labs/name-match'

describe('scoreNameMatch', () => {
  it('scores exact > prefix > substring > none, ignoring case and punctuation', () => {
    expect(scoreNameMatch('Total Cholesterol', 'total cholesterol')).toBe(1000)
    expect(scoreNameMatch('Vitamin D 25-OH', 'vitamin d')).toBe(800 - ('vitamind25oh'.length - 'vitamind'.length))
    expect(scoreNameMatch('Total Cholesterol', 'Cholesterol')).toBe(Math.round(400 * (11 / 16)))
    expect(scoreNameMatch('Ferritin', 'Iron')).toBe(0)
  })

  it('never matches when the needle merely contains the stored name', () => {
    expect(scoreNameMatch('Cholesterol', 'cholesterol and testosterone')).toBe(0)
  })

  it('returns 0 for empty input', () => {
    expect(scoreNameMatch('', 'x')).toBe(0)
    expect(scoreNameMatch('x', '')).toBe(0)
  })
})

describe('resolveBestMatch', () => {
  const names = (r: { name: string }) => [r.name]

  it('returns none, a single hit, or a clear winner', () => {
    expect(resolveBestMatch([{ name: 'Ferritin' }], 'Iron', names)).toEqual({ none: true })
    expect(resolveBestMatch([{ name: 'Ferritin' }], 'ferritin', names)).toEqual({ unique: { name: 'Ferritin' } })
    const rows = [{ name: 'Total Cholesterol' }, { name: 'Cholesterol' }]
    expect(resolveBestMatch(rows, 'Cholesterol', names)).toEqual({ unique: { name: 'Cholesterol' } })
  })

  it('reports up to five close candidates as ambiguous', () => {
    const rows = ['HDL Cholesterol', 'LDL Cholesterol', 'VLDL Cholesterol'].map((name) => ({ name }))
    const result = resolveBestMatch(rows, 'cholesterol', names)
    expect('ambiguous' in result && result.ambiguous.map((r) => r.name)).toEqual([
      'HDL Cholesterol',
      'LDL Cholesterol',
      'VLDL Cholesterol',
    ])
  })

  it('collapses catalogue duplicates with the same primary name', () => {
    const rows = [
      { name: 'Vitamin D', id: 'a' },
      { name: 'vitamin-d', id: 'b' },
    ]
    expect(resolveBestMatch(rows, 'vit', names)).toEqual({ unique: rows[0] })
    expect(resolveBestMatch(rows, 'vit', names, (a, b) => (a.id === 'b' ? -1 : b.id === 'b' ? 1 : 0))).toEqual({
      unique: rows[1],
    })
  })

  it('uses the best score across all keys of a row', () => {
    const rows = [{ name: 'Glycated haemoglobin', short: 'HbA1c' }, { name: 'Haemoglobin', short: null }]
    const result = resolveBestMatch(rows, 'hba1c', (r) => [r.name, r.short ?? ''])
    expect(result).toEqual({ unique: rows[0] })
  })
})

describe('preferSampleType', () => {
  const rows = ['Cortisol', 'Cortisol (Saliva)', 'Cortisol (Urine)', 'Calprotectin stool', 'Hair minerals']
  const text = (s: string) => s

  it('returns the rows unchanged without a hint', () => {
    expect(preferSampleType(rows, text, undefined)).toBe(rows)
  })

  it('keeps only rows of the requested sample class', () => {
    expect(preferSampleType(rows, text, 'blood')).toEqual(['Cortisol'])
    expect(preferSampleType(rows, text, 'serum')).toEqual(['Cortisol'])
    expect(preferSampleType(rows, text, 'urine')).toEqual(['Cortisol (Urine)'])
    expect(preferSampleType(rows, text, 'saliva')).toEqual(['Cortisol (Saliva)'])
    expect(preferSampleType(rows, text, 'stool')).toEqual(['Calprotectin stool'])
    expect(preferSampleType(rows, text, 'hair')).toEqual(['Hair minerals'])
  })

  it('falls back to all rows when the filter would empty the set', () => {
    expect(preferSampleType(['Cortisol'], text, 'urine')).toEqual(['Cortisol'])
  })
})

describe('firstLab', () => {
  it('unwraps an object, an array or null relation', () => {
    expect(firstLab({ name: 'A' })).toEqual({ name: 'A' })
    expect(firstLab([{ name: 'B' }, { name: 'C' }])).toEqual({ name: 'B' })
    expect(firstLab([])).toBeNull()
    expect(firstLab(null)).toBeNull()
  })
})
