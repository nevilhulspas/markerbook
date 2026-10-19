import { describe, it, expect } from 'vitest'

import { winAnsiSafe } from '@/lib/export/pdf-text'

describe('winAnsiSafe', () => {
  it('keeps everything the built-in font can draw', () => {
    expect(winAnsiSafe('Stack — 50 µg, 2×/day “daily” café ½ €3')).toBe(
      'Stack — 50 µg, 2×/day “daily” café ½ €3'
    )
  })

  it('spells out Greek letters and flattens sub- and superscript digits', () => {
    expect(winAnsiSafe('β-Alanine')).toBe('beta-Alanine')
    expect(winAnsiSafe('α-lipoic acid')).toBe('alpha-lipoic acid')
    expect(winAnsiSafe('Ω-3')).toBe('Omega-3')
    expect(winAnsiSafe('Vitamin K₂')).toBe('Vitamin K2')
    expect(winAnsiSafe('10⁹/L')).toBe('109/L')
  })

  it('maps the Greek mu to the micro sign', () => {
    expect(winAnsiSafe('50 μg')).toBe('50 µg')
  })

  it('marks anything else with "?" instead of dropping it', () => {
    expect(winAnsiSafe('fish oil 🐟')).toBe('fish oil ?')
    expect(winAnsiSafe('→')).toBe('?')
  })

  it('turns other whitespace into a plain space', () => {
    expect(winAnsiSafe('a\tb c')).toBe('a b c')
    expect(winAnsiSafe('Vitamin\u00a0D3 50\u00a0µg')).toBe('Vitamin D3 50 µg')
  })
})
