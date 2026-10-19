import { describe, it, expect } from 'vitest'

import {
  balancedSlice,
  extractArrayObjects,
  extractJsonObject,
  extractKeyedObject,
  stripFences,
} from '@/lib/ai/json'

// These pin the behaviour of the four identical copies that lived in
// lib/dexa/parse.ts and lib/labs/{analyze-homepage,extract-tests,match-test-biomarkers}.ts.

describe('balancedSlice', () => {
  it('returns the balanced object starting at the index', () => {
    expect(balancedSlice('x {"a":{"b":1}} y', 2)).toBe('{"a":{"b":1}}')
  })

  it('ignores braces inside strings, including escaped quotes', () => {
    expect(balancedSlice('{"a":"} \\" {"}', 0)).toBe('{"a":"} \\" {"}')
  })

  it('returns null when not at a brace or when the object never closes', () => {
    expect(balancedSlice('abc', 0)).toBeNull()
    expect(balancedSlice('{"a":1', 0)).toBeNull()
  })
})

describe('extractJsonObject', () => {
  it('finds the first object in prose or code fences', () => {
    expect(extractJsonObject('Here you go:\n```json\n{"ok":true}\n```')).toBe('{"ok":true}')
  })

  it('returns null without a brace or for a truncated object', () => {
    expect(extractJsonObject('no json here')).toBeNull()
    expect(extractJsonObject('{"markers":[{"a":1}')).toBeNull()
  })
})

describe('extractKeyedObject', () => {
  it('returns the object after the given key', () => {
    expect(extractKeyedObject('{"meta":{"lab":"X"},"tests":[]}', 'meta')).toBe('{"lab":"X"}')
  })

  it('returns null when the key or its object is missing', () => {
    expect(extractKeyedObject('{"a":1}', 'meta')).toBeNull()
    expect(extractKeyedObject('{"meta": null}', 'meta')).toBeNull()
  })
})

describe('extractArrayObjects', () => {
  it('returns every complete element object in order', () => {
    expect(extractArrayObjects('{"tests":[{"n":1}, {"n":2}]}', 'tests')).toEqual(['{"n":1}', '{"n":2}'])
  })

  it('salvages the complete elements before a truncated one', () => {
    expect(extractArrayObjects('{"tests":[{"n":1},{"n":2},{"n":', 'tests')).toEqual(['{"n":1}', '{"n":2}'])
  })

  it('returns [] when the key or array is missing', () => {
    expect(extractArrayObjects('{"other":[]}', 'tests')).toEqual([])
    expect(extractArrayObjects('{"tests": null}', 'tests')).toEqual([])
  })
})

describe('stripFences', () => {
  it('removes a json or bare code fence and trims', () => {
    expect(stripFences('  ```json\n{"a":1}\n```  ')).toBe('{"a":1}')
    expect(stripFences('```\n{"a":1}```')).toBe('{"a":1}')
  })

  it('leaves unfenced text alone apart from trimming', () => {
    expect(stripFences('  {"a":1}\n')).toBe('{"a":1}')
  })
})
