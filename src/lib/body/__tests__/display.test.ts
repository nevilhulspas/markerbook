import { describe, it, expect } from 'vitest'

import { targetInfo, goalDirection } from '../display'

describe('goalDirection', () => {
  it('classifies metrics', () => {
    expect(goalDirection('body_fat_pct')).toBe('lower_better')
    expect(goalDirection('visceral_fat_g')).toBe('lower_better')
    expect(goalDirection('ffmi')).toBe('higher_better')
    expect(goalDirection('bone_t_score')).toBe('higher_better')
    expect(goalDirection('total_mass_kg')).toBe('neutral')
  })
})

describe('targetInfo', () => {
  it('returns null without a target', () => {
    expect(targetInfo('body_fat_pct', 26.2, null)).toBeNull()
  })

  it('flags being over a lower-is-better target as bad', () => {
    const t = targetInfo('body_fat_pct', 26.2, 15)
    expect(t).toMatchObject({ target: '15%', gapText: '11.2% over', tone: 'bad' })
  })

  it('flags being under a higher-is-better target as bad', () => {
    const t = targetInfo('ffmi', 20.8, 22)
    expect(t).toMatchObject({ tone: 'bad' })
    expect(t?.gapText).toMatch(/1\.2.*under/)
  })

  it('flags being over a higher-is-better target as good', () => {
    const t = targetInfo('lean_mass_kg', 62, 60)
    expect(t).toMatchObject({ gapText: '2.0 kg over', tone: 'good' })
  })

  it('treats within-epsilon as on target', () => {
    expect(targetInfo('body_fat_pct', 15, 15)).toMatchObject({ gapText: 'on target', tone: 'good' })
  })

  it('keeps a neutral-direction metric uncolored', () => {
    expect(targetInfo('total_mass_kg', 87, 84)).toMatchObject({ gapText: '3.0 kg over', tone: 'neutral' })
  })
})
