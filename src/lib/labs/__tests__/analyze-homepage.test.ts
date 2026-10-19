import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// The module instantiates an Anthropic client at import time; a dummy key is
// enough since parseHomepageAnalysis never makes a network call.
vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')

import { parseHomepageAnalysis } from '../analyze-homepage'

const ALLOWED = [
  'https://lab.example/catalog',
  'https://lab.example/prices',
  'https://lab.example/catalog?page=2',
]

describe('parseHomepageAnalysis', () => {
  it('parses valid JSON into a typed result', () => {
    const json = JSON.stringify({
      isLabCatalogue: true,
      confidence: 'high',
      concern: null,
      catalogueUrls: ['https://lab.example/catalog', 'https://lab.example/prices'],
      hasPagination: true,
    })

    const result = parseHomepageAnalysis(json, ALLOWED)

    expect(result).toEqual({
      isLabCatalogue: true,
      confidence: 'high',
      concern: null,
      catalogueUrls: ['https://lab.example/catalog', 'https://lab.example/prices'],
      hasPagination: true,
    })
  })

  it('filters catalogueUrls to ONLY those present in allowedLinks (drops invented URLs)', () => {
    const json = JSON.stringify({
      isLabCatalogue: true,
      confidence: 'medium',
      concern: null,
      catalogueUrls: [
        'https://lab.example/catalog', // allowed -> kept
        'https://evil.example/inject', // NOT in allowedLinks -> dropped
        'https://lab.example/prices', // allowed -> kept
        'https://lab.example/catalog', // duplicate -> deduped
      ],
      hasPagination: false,
    })

    const result = parseHomepageAnalysis(json, ALLOWED)

    expect(result.catalogueUrls).toEqual([
      'https://lab.example/catalog',
      'https://lab.example/prices',
    ])
  })

  it('preserves isLabCatalogue:false and a concern string', () => {
    const json = JSON.stringify({
      isLabCatalogue: false,
      confidence: 'high',
      concern: 'This is a parked domain, not a diagnostic lab.',
      catalogueUrls: [],
      hasPagination: false,
    })

    const result = parseHomepageAnalysis(json, ALLOWED)

    expect(result.isLabCatalogue).toBe(false)
    expect(result.concern).toBe('This is a parked domain, not a diagnostic lab.')
    expect(result.catalogueUrls).toEqual([])
  })

  it('preserves an injection concern (manipulation attempt detected)', () => {
    const json = JSON.stringify({
      isLabCatalogue: false,
      confidence: 'low',
      concern: 'Page contains text attempting to give the model instructions.',
      catalogueUrls: ['https://lab.example/catalog'],
      hasPagination: false,
    })

    const result = parseHomepageAnalysis(json, ALLOWED)

    expect(result.concern).toMatch(/instructions/i)
    // Even with a concern, an invented/leaked URL would still be intersected;
    // here the URL is allowed so it survives the filter.
    expect(result.catalogueUrls).toEqual(['https://lab.example/catalog'])
  })

  it('tolerates JSON wrapped in ```json fences and surrounding prose', () => {
    const fenced = [
      'Here is my analysis:',
      '```json',
      JSON.stringify({
        isLabCatalogue: true,
        confidence: 'medium',
        concern: null,
        catalogueUrls: ['https://lab.example/catalog?page=2'],
        hasPagination: true,
      }),
      '```',
      'Let me know if you need more.',
    ].join('\n')

    const result = parseHomepageAnalysis(fenced, ALLOWED)

    expect(result.isLabCatalogue).toBe(true)
    expect(result.confidence).toBe('medium')
    expect(result.catalogueUrls).toEqual(['https://lab.example/catalog?page=2'])
    expect(result.hasPagination).toBe(true)
  })

  it('coerces missing/invalid fields to safe defaults', () => {
    const json = JSON.stringify({
      // isLabCatalogue missing -> false
      confidence: 'not-a-level', // invalid -> 'low'
      // concern missing -> null
      catalogueUrls: 'not-an-array', // invalid -> []
      // hasPagination missing -> false
    })

    const result = parseHomepageAnalysis(json, ALLOWED)

    expect(result).toEqual({
      isLabCatalogue: false,
      confidence: 'low',
      concern: null,
      catalogueUrls: [],
      hasPagination: false,
    })
  })

  it('returns the safe rejecting default on non-JSON garbage', () => {
    const result = parseHomepageAnalysis('this is not json at all', ALLOWED)

    expect(result.isLabCatalogue).toBe(false)
    expect(result.concern).toBe('Could not analyse the page.')
    expect(result.catalogueUrls).toEqual([])
    expect(result.hasPagination).toBe(false)
  })

  it('returns the safe rejecting default on a truncated (unbalanced) object', () => {
    const truncated = '{"isLabCatalogue":true,"confidence":"high","catalogueUrls":['

    const result = parseHomepageAnalysis(truncated, ALLOWED)

    expect(result.isLabCatalogue).toBe(false)
    expect(result.concern).toBe('Could not analyse the page.')
  })
})
