import { describe, it, expect } from 'vitest'

import { labListToText, summarizeCostByCurrency } from '../export-lab-list'
import { DEFAULT_FORMAT } from '../list-format'
import type { ExportList } from '@/lib/labs/lab-test-tools'

const list: ExportList = {
  labName: 'BODIMED',
  labFound: true,
  items: [
    {
      testName: 'Ferritin',
      found: true,
      method: 'ECLIA',
      cost: 18,
      currency: 'BGN',
      turnaround_days: 1,
      sample_type: 'serum',
      reason: 'last value low',
    },
    {
      testName: 'Made Up Test',
      found: false,
      method: null,
      cost: null,
      currency: null,
      turnaround_days: null,
      sample_type: null,
      reason: null,
    },
  ],
}

describe('labListToText', () => {
  it('renders a deterministic per-lab document', () => {
    const txt = labListToText(list, DEFAULT_FORMAT, '2026-05-25')
    expect(txt).toContain('Tests to request — BODIMED')
    expect(txt).toContain('Generated: 2026-05-25')
    expect(txt).toContain('1. Ferritin')
    expect(txt).toContain('ECLIA · 18 BGN · serum · 1 day')
    expect(txt).toContain('Why: last value low')
    // Unavailable tests stay in the list but without a "(not available)" label.
    expect(txt).toContain('2. Made Up Test')
    expect(txt).not.toContain('not available')
    expect(txt).toContain('Estimated total (available tests): 18 BGN')
  })

  it('notes when the lab itself was not found', () => {
    const txt = labListToText({ ...list, labFound: false }, DEFAULT_FORMAT, '2026-05-25')
    expect(txt).toContain('not found in the directory')
  })
})

describe('summarizeCostByCurrency', () => {
  it('totals available, priced items per currency and ignores the rest', () => {
    const result = summarizeCostByCurrency([
      { testName: 'A', found: true, method: null, cost: 10, currency: 'BGN', turnaround_days: null, sample_type: null, reason: null },
      { testName: 'B', found: true, method: null, cost: 5.5, currency: 'BGN', turnaround_days: null, sample_type: null, reason: null },
      { testName: 'C', found: true, method: null, cost: 9.71, currency: 'EUR', turnaround_days: null, sample_type: null, reason: null },
      { testName: 'D', found: false, method: null, cost: 99, currency: 'BGN', turnaround_days: null, sample_type: null, reason: null }, // not available → excluded
      { testName: 'E', found: true, method: null, cost: null, currency: 'BGN', turnaround_days: null, sample_type: null, reason: null }, // no price → excluded
    ])
    expect(result).toBe('15.5 BGN + 9.71 EUR')
  })

  it('returns empty string when nothing is priced', () => {
    expect(
      summarizeCostByCurrency([
        { testName: 'X', found: false, method: null, cost: null, currency: null, turnaround_days: null, sample_type: null, reason: null },
      ])
    ).toBe('')
  })
})
