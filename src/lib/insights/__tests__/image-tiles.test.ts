import { describe, it, expect } from 'vitest'

import {
  planImageLayout,
  MAX_LONG_EDGE,
  TARGET_MEGAPIXELS,
  TILE_SHORT_EDGE,
} from '../image-tiles'

describe('planImageLayout', () => {
  it('resizes a normal-aspect photo to a single tile within the long-edge + megapixel bounds', () => {
    const plan = planImageLayout(4032, 3024) // ~12 MP phone photo, 4:3
    expect(plan.mode).toBe('single')
    expect(plan.rects).toHaveLength(1)
    const r = plan.rects[0]
    expect(Math.max(r.dw, r.dh)).toBeLessThanOrEqual(MAX_LONG_EDGE)
    expect(r.dw * r.dh).toBeLessThanOrEqual(TARGET_MEGAPIXELS * 1.01)
    // covers the whole source
    expect(r).toMatchObject({ sx: 0, sy: 0, sw: 4032, sh: 3024 })
  })

  it('a small image is left effectively as-is (single tile, not upscaled)', () => {
    const plan = planImageLayout(800, 600)
    expect(plan.mode).toBe('single')
    expect(plan.rects[0]).toMatchObject({ dw: 800, dh: 600 })
  })

  it('tiles a long portrait receipt into multiple ~square page tiles that stay legible', () => {
    const plan = planImageLayout(1200, 9000) // tall receipt
    expect(plan.mode).toBe('tiles')
    expect(plan.rects.length).toBeGreaterThan(1)
    for (const r of plan.rects) {
      // each tile is bounded + roughly square (NOT crushed to a sliver)
      expect(Math.max(r.dw, r.dh)).toBeLessThanOrEqual(MAX_LONG_EDGE)
      expect(r.dw * r.dh).toBeLessThanOrEqual(TARGET_MEGAPIXELS * 1.01)
      expect(r.dw).toBe(Math.min(1200, TILE_SHORT_EDGE)) // short edge preserved (legible text)
      expect(Math.max(r.dw, r.dh) / Math.min(r.dw, r.dh)).toBeLessThan(2) // ~square
      expect(r.sx).toBe(0)
      expect(r.sw).toBe(1200)
    }
    // tiles cover the full height (last tile reaches the bottom)
    const last = plan.rects[plan.rects.length - 1]
    expect(last.sy + last.sh).toBe(9000)
  })

  it('tiles a wide (landscape) extreme image along the x-axis', () => {
    const plan = planImageLayout(9000, 1000)
    expect(plan.mode).toBe('tiles')
    for (const r of plan.rects) {
      expect(r.sy).toBe(0)
      expect(r.sh).toBe(1000)
      expect(r.dh).toBe(Math.min(1000, TILE_SHORT_EDGE))
    }
    const last = plan.rects[plan.rects.length - 1]
    expect(last.sx + last.sw).toBe(9000)
  })

  it('adjacent tiles overlap so a boundary-straddling line is whole in one tile', () => {
    const plan = planImageLayout(1200, 9000)
    expect(plan.rects.length).toBeGreaterThan(1)
    // step (start-to-start) is smaller than a tile's source height → overlap
    const step = plan.rects[1].sy - plan.rects[0].sy
    expect(step).toBeLessThan(plan.rects[0].sh)
  })
})
