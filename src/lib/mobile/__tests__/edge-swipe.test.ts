import { describe, it, expect } from 'vitest'

import { shouldOpenDrawer, shouldCloseDrawer } from '@/lib/mobile/edge-swipe'

const config = { edgeZonePx: 24, thresholdPx: 40 }

describe('shouldOpenDrawer', () => {
  it('opens on a rightward swipe that starts at the left edge', () => {
    expect(shouldOpenDrawer({ startX: 5, dx: 50, dy: 5 }, config)).toBe(true)
  })

  it('ignores swipes that start away from the edge', () => {
    expect(shouldOpenDrawer({ startX: 120, dx: 50, dy: 5 }, config)).toBe(false)
  })

  it('ignores swipes that have not travelled far enough', () => {
    expect(shouldOpenDrawer({ startX: 5, dx: 30, dy: 5 }, config)).toBe(false)
  })

  it('ignores mostly-vertical gestures (a scroll, not a swipe)', () => {
    expect(shouldOpenDrawer({ startX: 5, dx: 50, dy: 80 }, config)).toBe(false)
  })

  it('ignores leftward movement', () => {
    expect(shouldOpenDrawer({ startX: 5, dx: -50, dy: 5 }, config)).toBe(false)
  })
})

describe('shouldCloseDrawer', () => {
  it('closes on a leftward swipe past the threshold', () => {
    expect(shouldCloseDrawer({ startX: 300, dx: -50, dy: 5 }, { thresholdPx: 40 })).toBe(true)
  })

  it('ignores rightward movement', () => {
    expect(shouldCloseDrawer({ startX: 300, dx: 50, dy: 5 }, { thresholdPx: 40 })).toBe(false)
  })

  it('ignores leftward movement that is too small', () => {
    expect(shouldCloseDrawer({ startX: 300, dx: -30, dy: 5 }, { thresholdPx: 40 })).toBe(false)
  })

  it('ignores mostly-vertical gestures', () => {
    expect(shouldCloseDrawer({ startX: 300, dx: -50, dy: 80 }, { thresholdPx: 40 })).toBe(false)
  })
})
