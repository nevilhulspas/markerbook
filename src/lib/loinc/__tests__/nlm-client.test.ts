import { describe, it, expect } from 'vitest'
import { parseLoincSearch, buildSearchUrl, searchLoinc } from '../nlm-client'

const SAMPLE = [
  2,
  ['718-7', '20509-6'],
  {
    COMPONENT: ['Hemoglobin', 'Hemoglobin'],
    METHOD_TYP: ['', 'Calculation'],
    units: [[{ unit: 'g/dL' }], null],
    PROPERTY: ['MCnc', 'MCnc'],
  },
  [
    ['718-7', 'Hemoglobin [Mass/volume] in Blood'],
    ['20509-6', 'Hemoglobin [Mass/volume] in Blood by calculation'],
  ],
]

describe('nlm-client', () => {
  it('builds a search URL requesting the lab fields', () => {
    const url = buildSearchUrl('hemoglobin')
    expect(url).toContain('terms=hemoglobin')
    expect(url).toContain('ef=COMPONENT,METHOD_TYP,units,PROPERTY')
    expect(url).toContain('df=LOINC_NUM,LONG_COMMON_NAME')
  })

  it('parses the 4-element NLM response into candidates, mapping empty method/null units to null', () => {
    const out = parseLoincSearch(SAMPLE)
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({
      code: '718-7',
      longName: 'Hemoglobin [Mass/volume] in Blood',
      component: 'Hemoglobin',
      ucumUnit: 'g/dL',
      method: null,
      property: 'MCnc',
    })
    expect(out[1].ucumUnit).toBeNull()
    expect(out[1].method).toBe('Calculation')
  })

  it('returns [] for an empty result', () => {
    expect(parseLoincSearch([0, [], {}, []])).toEqual([])
  })

  it('searchLoinc throws on non-ok response', async () => {
    const mockFetch = async () => ({ ok: false, status: 503 }) as Response
    await expect(searchLoinc('ferritin', mockFetch)).rejects.toThrow(
      'NLM LOINC search failed: 503',
    )
  })
})
