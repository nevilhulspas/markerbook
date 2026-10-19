import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// The module instantiates an Anthropic client at import time; a dummy key is
// enough since parseExtraction never makes a network call.
vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')

import {
  parseExtraction,
  chunkText,
  mergeLabData,
  type ScrapedLabData,
} from '../extract-tests'

describe('parseExtraction', () => {
  it('parses valid JSON into a typed result', () => {
    const json = JSON.stringify({
      profile: { country: 'NL', city: 'Amsterdam', description: 'A lab.' },
      tests: [
        {
          name: 'Lipid Panel',
          method: 'Spectrophotometry',
          cost: 49.95,
          currency: 'EUR',
          sample_type: 'serum',
          turnaround_days: 2,
        },
      ],
    })

    const result = parseExtraction(json)

    expect(result.profile).toEqual({
      country: 'NL',
      city: 'Amsterdam',
      description: 'A lab.',
    })
    expect(result.tests).toHaveLength(1)
    expect(result.tests[0]).toEqual({
      name: 'Lipid Panel',
      method: 'Spectrophotometry',
      cost: 49.95,
      currency: 'EUR',
      sample_type: 'serum',
      turnaround_days: 2,
    })
  })

  it('parses JSON wrapped in ```json fences and surrounding prose', () => {
    const fenced = [
      'Here is the data you asked for:',
      '```json',
      JSON.stringify({
        profile: { country: 'US', city: null, description: null },
        tests: [{ name: 'CBC' }],
      }),
      '```',
      'Let me know if you need anything else.',
    ].join('\n')

    const result = parseExtraction(fenced)

    expect(result.profile.country).toBe('US')
    expect(result.tests).toHaveLength(1)
    expect(result.tests[0].name).toBe('CBC')
  })

  it('drops malformed test entries (missing/empty name) but keeps valid ones', () => {
    const json = JSON.stringify({
      profile: { country: null, city: null, description: null },
      tests: [
        { name: 'Valid Test' },
        { name: '' }, // empty name -> dropped
        { method: 'x' }, // no name -> dropped
        { name: '   ' }, // whitespace-only -> dropped
        'not-an-object', // wrong type -> dropped
        { name: 'Second Valid' },
      ],
    })

    const result = parseExtraction(json)

    expect(result.tests.map((t) => t.name)).toEqual([
      'Valid Test',
      'Second Valid',
    ])
  })

  it('coerces numeric strings and currency-formatted costs to numbers', () => {
    const json = JSON.stringify({
      profile: { country: null, city: null, description: null },
      tests: [
        {
          name: 'Vitamin D',
          cost: '€ 39,50',
          turnaround_days: '3',
        },
      ],
    })

    const result = parseExtraction(json)

    expect(result.tests[0].cost).toBe(39.5)
    expect(result.tests[0].turnaround_days).toBe(3)
  })

  it('defaults missing optional fields to null', () => {
    const json = JSON.stringify({
      profile: {},
      tests: [{ name: 'Glucose' }],
    })

    const result = parseExtraction(json)

    expect(result.profile).toEqual({
      country: null,
      city: null,
      description: null,
    })
    expect(result.tests[0]).toEqual({
      name: 'Glucose',
      method: null,
      cost: null,
      currency: null,
      sample_type: null,
      turnaround_days: null,
    })
  })

  it('throws on non-JSON garbage', () => {
    expect(() => parseExtraction('this is not json at all')).toThrow()
  })

  it('salvages complete tests + profile from a truncated (unbalanced) response', () => {
    // Simulates the model hitting its token limit mid-array: the outer object
    // and the final test object are never closed.
    const truncated =
      '{"profile":{"country":"BG","city":"Sofia","description":"A lab."},"tests":[' +
      '{"name":"Test A","cost":10,"currency":"BGN"},' +
      '{"name":"Test B","cost":20,"currency":"BGN"},' +
      '{"name":"Test C","cost":3' // cut off mid-object — must be dropped

    const result = parseExtraction(truncated)

    expect(result.profile).toEqual({
      country: 'BG',
      city: 'Sofia',
      description: 'A lab.',
    })
    expect(result.tests.map((t) => t.name)).toEqual(['Test A', 'Test B'])
    expect(result.tests[0].cost).toBe(10)
  })
})

describe('chunkText', () => {
  it('returns a single chunk when text fits', () => {
    expect(chunkText('short text', 100)).toEqual(['short text'])
  })

  it('splits long text into contiguous chunks within the limit', () => {
    const text = 'word '.repeat(100) // 500 chars, whitespace-separated
    const chunks = chunkText(text, 60)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(60)
    // Contiguous slices — joining reconstructs the original exactly.
    expect(chunks.join('')).toBe(text)
  })
})

describe('mergeLabData', () => {
  const test = (name: string): ScrapedLabData['tests'][number] => ({
    name,
    method: null,
    cost: null,
    currency: null,
    sample_type: null,
    turnaround_days: null,
  })

  it('merges profiles (first non-null wins) and dedupes tests case-insensitively', () => {
    const merged = mergeLabData([
      {
        profile: { country: null, city: 'Sofia', description: null },
        tests: [test('Glucose'), test('Iron')],
      },
      {
        profile: { country: 'BG', city: 'Other', description: 'A lab.' },
        tests: [test('glucose'), test('Ferritin')], // 'glucose' is a dup of 'Glucose'
      },
    ])

    expect(merged.profile).toEqual({
      country: 'BG',
      city: 'Sofia',
      description: 'A lab.',
    })
    expect(merged.tests.map((t) => t.name)).toEqual([
      'Glucose',
      'Iron',
      'Ferritin',
    ])
  })
})
