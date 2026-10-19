import { describe, it, expect } from 'vitest'
import { navigationItems, isNavGroup } from '@/data/navigation'

describe('navigationItems', () => {
  it('includes a Nutrition leaf linking to /nutrition', () => {
    const leaves = navigationItems.flatMap((e) => (isNavGroup(e) ? e.items : [e]))
    expect(leaves.some((l) => l.href === '/nutrition')).toBe(true)
  })
})
