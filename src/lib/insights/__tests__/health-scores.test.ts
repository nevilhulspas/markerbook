import { describe, it, expect } from 'vitest'
import { computeHealthScores } from '../health-scores'
import { rangesWithInline } from '@/lib/grid/reference-range'
import type { GridRow } from '@/lib/grid/grid-types'
import type { Biomarker } from '@/lib/database.types'

const biomarker = {
  id: 'bm-1',
  name: 'Methylmalonate',
  short_name: null,
  unit: 'nmol/L',
  ref_range_low: 0,
  ref_range_high: 400,
  ref_range_low_male: null,
  ref_range_high_male: null,
  ref_range_low_female: null,
  ref_range_high_female: null,
  loinc_code: '2629-4',
  molar_mass: null,
  valence: null,
  typical_mass_unit: null,
  typical_molar_unit: null,
} as unknown as Biomarker

describe('inline biomarker ranges outside the grid (regression)', () => {
  it('health scores judge a marker with only an inline range, like the grid', () => {
    const row: GridRow = {
      biomarker,
      category: 'Chem',
      values: { t1: { value: 900, unit: 'nmol/L', resultId: 'r1' } },
      referenceRanges: [],
    }
    const scores = computeHealthScores([row], 't1')
    expect(scores.totalOutOfRange).toBe(1)
    expect(scores.totalUnknown).toBe(0)
  })

  it('rangesWithInline makes range rows from the inline columns only when none exist', () => {
    const made = rangesWithInline(biomarker, [])
    expect(made).toHaveLength(1)
    expect(made[0]).toMatchObject({ unit: 'nmol/L', sex: 'general', range_low: 0, range_high: 400 })
    const own = [{ ...made[0], id: 'real', range_high: 300 }]
    expect(rangesWithInline(biomarker, own)).toBe(own)
  })
})
