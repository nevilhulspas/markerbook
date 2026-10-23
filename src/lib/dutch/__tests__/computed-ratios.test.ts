import { describe, it, expect } from 'vitest'
import { DUTCH_RATIOS, sumTimepoints } from '../computed-ratios'

const tps = ['waking', 'morning', 'afternoon', 'night']

describe('DUTCH 24h totals (regression: summed from incomplete time points)', () => {
  it('sums all four time points', () => {
    const r = new Map(tps.map((tp, i) => [`Free Cortisol (Urine)_${tp}`, i + 1]))
    expect(sumTimepoints(r, 'Free Cortisol (Urine)', tps)).toBe(10)
  })

  it('gives no total when a time point is missing', () => {
    const r = new Map([
      ['Free Cortisol (Urine)_waking', 10],
      ['Free Cortisol (Urine)_morning', 40],
      ['Free Cortisol (Urine)_afternoon', 12],
    ])
    expect(sumTimepoints(r, 'Free Cortisol (Urine)', tps)).toBeNull()
    const def = DUTCH_RATIOS.find((d) => d.name === '24h_free_cortisol')!
    expect(def.compute(r, new Map())).toBeNull()
  })

  it('gives no metabolized cortisol when one of its three parts is missing', () => {
    const def = DUTCH_RATIOS.find((d) => d.name === 'metabolized_cortisol')!
    const partial = new Map([['a-Tetrahydrocortisol', 100], ['b-Tetrahydrocortisol', 200]])
    expect(def.compute(partial, new Map())).toBeNull()
    partial.set('b-Tetrahydrocortisone', 300)
    expect(def.compute(partial, new Map())).toBe(600)
  })
})
