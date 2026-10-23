import { describe, it, expect } from 'vitest'
import { findSameDateTests } from '../same-date-tests'

describe('findSameDateTests (regression: re-import created a twin test)', () => {
  const tests = [
    { id: 'a', test_date: '2026-05-01' },
    { id: 'b', test_date: '2026-06-01' },
  ]
  it('finds a test on the report date', () => {
    expect(findSameDateTests(tests, '2026-05-01').map((t) => t.id)).toEqual(['a'])
  })
  it('finds nothing for another date or no date', () => {
    expect(findSameDateTests(tests, '2026-05-02')).toEqual([])
    expect(findSameDateTests(tests, null)).toEqual([])
  })
})
