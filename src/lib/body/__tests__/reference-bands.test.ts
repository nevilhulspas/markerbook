import { describe, it, expect } from 'vitest'

import { classifyMetric } from '../reference-bands'

const male = { sex: 'male' as const, age: 38 }

describe('classifyMetric — body_fat_pct (male)', () => {
  it('18% is good', () => {
    expect(classifyMetric('body_fat_pct', 18, male).band).toBe('good')
  })
  it('26.2% is needs_focus', () => {
    expect(classifyMetric('body_fat_pct', 26.2, male).band).toBe('needs_focus')
  })
  it('female bands are more lenient (26% → fair, not needs_focus)', () => {
    expect(classifyMetric('body_fat_pct', 26, { sex: 'female', age: 38 }).band).toBe('fair')
  })
})

describe('classifyMetric — bone_t_score (WHO)', () => {
  it('+0.2 is excellent (normal bone)', () => {
    expect(classifyMetric('bone_t_score', 0.2, male).band).toBe('excellent')
  })
  it('-1.5 is fair (osteopenia)', () => {
    expect(classifyMetric('bone_t_score', -1.5, male).band).toBe('fair')
  })
  it('-2.6 is needs_focus (osteoporosis range)', () => {
    expect(classifyMetric('bone_t_score', -2.6, male).band).toBe('needs_focus')
  })
})

describe('classifyMetric — FFMI / ALMI (higher better)', () => {
  it('FFMI 20.8 is good', () => {
    expect(classifyMetric('ffmi', 20.8, male).band).toBe('good')
  })
  it('ALMI 9.9 is good', () => {
    expect(classifyMetric('almi', 9.9, male).band).toBe('good')
  })
})

describe('classifyMetric — edge cases', () => {
  it('null value → null band', () => {
    expect(classifyMetric('ffmi', null, male).band).toBeNull()
  })
  it('metric without bands (lean_mass_kg) → null band', () => {
    expect(classifyMetric('lean_mass_kg', 61.7, male).band).toBeNull()
  })
  it('unknown metric → null band', () => {
    expect(classifyMetric('nope', 1, male).band).toBeNull()
  })
})
