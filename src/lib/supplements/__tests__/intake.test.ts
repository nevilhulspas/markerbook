import { describe, it, expect } from 'vitest'

import {
  normalizeTime,
  deriveFrequency,
  groupByIntakeTime,
} from '@/lib/supplements/intake'
import type { SupplementWithIntakes } from '@/lib/database.types'

function supp(
  name: string,
  intakes: { time: string; amount: string | null }[]
): SupplementWithIntakes {
  return {
    id: name,
    user_id: 'u1',
    name,
    dose: null,
    frequency: null,
    start_date: '2026-08-01',
    end_date: null,
    notes: null,
    created_at: '',
    updated_at: '',
    intakes,
  }
}

describe('normalizeTime', () => {
  it('trims Postgres seconds', () => {
    expect(normalizeTime('08:00:00')).toBe('08:00')
  })

  it('leaves an HH:MM string alone', () => {
    expect(normalizeTime('22:30')).toBe('22:30')
  })
})

describe('deriveFrequency', () => {
  it('falls back to the legacy text when there are no moments', () => {
    expect(deriveFrequency([], '2x daily')).toBe('2x daily')
  })

  it('returns null when there are no moments and no legacy text', () => {
    expect(deriveFrequency([], null)).toBeNull()
  })

  it('marks a stopped supplement as history, not a live schedule', () => {
    expect(
      deriveFrequency([{ time: '08:00', amount: null }], null, '2026-01-31')
    ).toBe('1x daily (when taken)')
  })

  it('leaves a running supplement unqualified', () => {
    expect(deriveFrequency([{ time: '08:00', amount: null }], null, null)).toBe(
      '1x daily'
    )
  })

  it('derives from the moment count, ignoring legacy text', () => {
    expect(deriveFrequency([{ time: '08:00', amount: null }], '9x daily')).toBe(
      '1x daily'
    )
    expect(
      deriveFrequency(
        [
          { time: '08:00', amount: null },
          { time: '22:00', amount: null },
        ],
        null
      )
    ).toBe('2x daily')
  })
})

describe('groupByIntakeTime', () => {
  it('returns an empty array for no supplements', () => {
    expect(groupByIntakeTime([])).toEqual([])
  })

  it('puts a split intake in both groups with its own amount', () => {
    const groups = groupByIntakeTime([
      supp('Magnesium', [
        { time: '22:00', amount: '2 capsules' },
        { time: '08:00', amount: '1 capsule' },
      ]),
    ])
    expect(groups.map((g) => g.time)).toEqual(['08:00', '22:00'])
    expect(groups[0].rows[0].amount).toBe('1 capsule')
    expect(groups[1].rows[0].amount).toBe('2 capsules')
  })

  it('sorts groups by time and names within a group', () => {
    const groups = groupByIntakeTime([
      supp('zinc', [{ time: '08:00', amount: null }]),
      supp('Creatine', [{ time: '08:00', amount: null }]),
      supp('Glycine', [{ time: '22:00', amount: null }]),
    ])
    expect(groups.map((g) => g.time)).toEqual(['08:00', '22:00'])
    expect(groups[0].rows.map((r) => r.supplement.name)).toEqual([
      'Creatine',
      'zinc',
    ])
  })

  it('collects supplements without moments into one trailing null group', () => {
    const groups = groupByIntakeTime([
      supp('Boron', []),
      supp('Creatine', [{ time: '08:00', amount: null }]),
      supp('Akkermansia', []),
    ])
    expect(groups.map((g) => g.time)).toEqual(['08:00', null])
    expect(groups[1].rows.map((r) => r.supplement.name)).toEqual([
      'Akkermansia',
      'Boron',
    ])
  })
})
