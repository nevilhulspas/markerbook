import { describe, it, expect } from 'vitest'

import { formatListItems, normalizeFormat, DEFAULT_FORMAT } from '../list-format'
import type { ExportListItem } from '@/lib/labs/lab-test-tools'

const item = (over: Partial<ExportListItem>): ExportListItem => ({
  testName: 'X', found: true, method: null, cost: null, currency: null,
  turnaround_days: null, sample_type: null, reason: null, ...over,
})

const items: ExportListItem[] = [
  item({ testName: 'Ferritin', found: true, cost: 12 }),
  item({ testName: 'ALP', found: false, cost: null }),
  item({ testName: 'Albumin', found: true, cost: 1.4 }),
]

describe('formatListItems', () => {
  it('keeps order + all items by default', () => {
    const out = formatListItems(items, DEFAULT_FORMAT)
    expect(out.map((i) => i.testName)).toEqual(['Ferritin', 'ALP', 'Albumin'])
  })

  it('hides unavailable when asked', () => {
    const out = formatListItems(items, { ...DEFAULT_FORMAT, hideUnavailable: true })
    expect(out.map((i) => i.testName)).toEqual(['Ferritin', 'Albumin'])
  })

  it('sorts by name (locale-aware)', () => {
    const out = formatListItems(items, { ...DEFAULT_FORMAT, sort: 'name' })
    // localeCompare orders "Albumin" before "ALP" (3rd char b < P, case-insensitive).
    expect(out.map((i) => i.testName)).toEqual(['Albumin', 'ALP', 'Ferritin'])
  })

  it('sorts by cost ascending with unpriced last', () => {
    const out = formatListItems(items, { ...DEFAULT_FORMAT, sort: 'cost_asc' })
    expect(out.map((i) => i.testName)).toEqual(['Albumin', 'Ferritin', 'ALP'])
  })

  it('sorts by cost descending with unpriced still last', () => {
    const out = formatListItems(items, { ...DEFAULT_FORMAT, sort: 'cost_desc' })
    expect(out.map((i) => i.testName)).toEqual(['Ferritin', 'Albumin', 'ALP'])
  })
})

describe('normalizeFormat', () => {
  it('defaults when given nothing', () => {
    expect(normalizeFormat(null)).toEqual(DEFAULT_FORMAT)
  })
  it('keeps only known columns in canonical order', () => {
    const f = normalizeFormat({ columns: ['cost', 'bogus' as never, 'method'] })
    expect(f.columns).toEqual(['method', 'cost'])
  })
  it('coerces an unknown sort to default', () => {
    expect(normalizeFormat({ sort: 'whatever' as never }).sort).toBe('default')
  })
})
