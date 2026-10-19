import { describe, it, expect } from 'vitest'

import { computeKeyboardInset } from '@/lib/mobile/keyboard-inset'

describe('computeKeyboardInset', () => {
  it('returns 0 when the visual viewport reaches the anchor bottom', () => {
    expect(computeKeyboardInset(800, 800, 0)).toBe(0)
  })

  it('returns the occluded height when a keyboard is open', () => {
    expect(computeKeyboardInset(800, 500, 0)).toBe(300)
  })

  it('ignores small deltas (URL bar collapse, not a keyboard)', () => {
    expect(computeKeyboardInset(800, 760, 0)).toBe(0)
  })

  it('accounts for visual-viewport scroll offset', () => {
    expect(computeKeyboardInset(800, 500, 50)).toBe(250)
  })

  it('never returns negative', () => {
    expect(computeKeyboardInset(800, 900, 0)).toBe(0)
  })

  // Values recorded in the iOS WKWebView (iPhone 17 Pro simulator): at the
  // last visualViewport event of the keyboard-show transition,
  // window.innerHeight transiently read 471 (== visual height) before
  // snapping back to 874 with no further event. Anchoring on the input
  // container's rect bottom (874, laid out against the keyboard-stable dvh
  // root) instead of innerHeight keeps the inset correct at that moment.
  it('survives the WKWebView keyboard-show transient when fed the anchor bottom', () => {
    expect(computeKeyboardInset(874, 471, 0)).toBe(403)
  })
})
