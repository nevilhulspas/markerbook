import { describe, it, expect, vi } from 'vitest'

// The module instantiates an Anthropic client at import time; a dummy key is
// enough since buildCatalogIndex / parseTestMatches never make a network call.
vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')

import {
  buildCatalogIndex,
  parseTestMatches,
  type CatalogBiomarker,
} from '../match-test-biomarkers'

const catalog: CatalogBiomarker[] = [
  { id: 'chol', name: 'Total Cholesterol', short_name: 'TC', aliases: ['Cholesterol'], parent_id: null, variant_name: null },
  { id: 'hdl', name: 'HDL Cholesterol', short_name: 'HDL', aliases: [], parent_id: null, variant_name: null },
  { id: 'ferr', name: 'Ferritin', short_name: null, aliases: ['Ferritine'], parent_id: null, variant_name: null },
  // A parent biomarker (has children) plus its variants.
  { id: 'testo-parent', name: 'Testosterone', short_name: null, aliases: [], parent_id: null, variant_name: null },
  { id: 'testo-total', name: 'Testosterone Total', short_name: null, aliases: [], parent_id: 'testo-parent', variant_name: 'total' },
  { id: 'testo-free', name: 'Free Testosterone', short_name: null, aliases: [], parent_id: 'testo-parent', variant_name: 'free' },
]

describe('buildCatalogIndex.resolve', () => {
  const { resolve } = buildCatalogIndex(catalog)

  it('matches the canonical name case-insensitively', () => {
    expect(resolve('Total Cholesterol')).toBe('chol')
    expect(resolve('  total cholesterol  ')).toBe('chol')
  })

  it('matches short_name and aliases', () => {
    expect(resolve('HDL')).toBe('hdl')
    expect(resolve('TC')).toBe('chol')
    expect(resolve('Ferritine')).toBe('ferr')
  })

  it('resolves an ambiguous parent name to its "total" variant', () => {
    // "Testosterone" is a parent (has children) so it is not itself a target;
    // it resolves to the total variant (the common lab convention).
    expect(resolve('Testosterone')).toBe('testo-total')
    // The variants themselves still resolve directly.
    expect(resolve('Free Testosterone')).toBe('testo-free')
    expect(resolve('Testosterone Total')).toBe('testo-total')
  })

  it('returns null for unknown or empty names', () => {
    expect(resolve('Not A Real Biomarker')).toBeNull()
    expect(resolve('')).toBeNull()
    expect(resolve('   ')).toBeNull()
  })
})

describe('buildCatalogIndex.promptLines', () => {
  const { promptLines } = buildCatalogIndex(catalog)

  it('lists only matchable biomarkers (excludes parent-only) with alias hints', () => {
    // 6 biomarkers minus the parent-only "Testosterone" = 5.
    expect(promptLines).toHaveLength(5)
    expect(promptLines).toContain('- Total Cholesterol (aka: TC, Cholesterol)')
    expect(promptLines).toContain('- Ferritin (aka: Ferritine)')
    expect(promptLines).toContain('- Testosterone Total')
    // The parent-only name must never be offered to the model.
    expect(promptLines.some((l) => l === '- Testosterone')).toBe(false)
  })
})

describe('parseTestMatches', () => {
  const { resolve } = buildCatalogIndex(catalog)

  it('resolves proposed names to ids and drops names not in the catalogue', () => {
    const json = JSON.stringify({
      matches: [
        { index: 1, biomarkers: ['Total Cholesterol', 'HDL'] },
        { index: 2, biomarkers: ['Ferritine', 'Made Up Marker'] },
        { index: 3, biomarkers: [] },
      ],
    })
    const result = parseTestMatches(json, resolve)
    expect(result).toEqual([
      { index: 1, biomarkerIds: ['chol', 'hdl'] },
      { index: 2, biomarkerIds: ['ferr'] }, // hallucinated name dropped
      { index: 3, biomarkerIds: [] },
    ])
  })

  it('deduplicates biomarker ids that resolve to the same target', () => {
    const json = JSON.stringify({
      matches: [{ index: 1, biomarkers: ['Total Cholesterol', 'Cholesterol', 'TC'] }],
    })
    expect(parseTestMatches(json, resolve)).toEqual([
      { index: 1, biomarkerIds: ['chol'] },
    ])
  })

  it('ignores invalid index and non-string biomarker entries', () => {
    const json = JSON.stringify({
      matches: [
        { index: 'oops', biomarkers: ['HDL'] }, // invalid index → dropped
        { index: 2, biomarkers: [123, 'HDL', null] }, // non-strings ignored
      ],
    })
    expect(parseTestMatches(json, resolve)).toEqual([
      { index: 2, biomarkerIds: ['hdl'] },
    ])
  })

  it('salvages complete entries from a response truncated mid-array', () => {
    // Model hit max_tokens: the matches array never closes and the last object
    // is cut off. The complete leading entries must still be recovered.
    const truncated =
      '{"matches":[{"index":1,"biomarkers":["Ferritin"]},{"index":2,"biomarkers":["HD'
    expect(parseTestMatches(truncated, resolve)).toEqual([
      { index: 1, biomarkerIds: ['ferr'] },
    ])
  })

  it('returns an empty list for unparseable text', () => {
    expect(parseTestMatches('not json at all', resolve)).toEqual([])
    expect(parseTestMatches('', resolve)).toEqual([])
  })
})
