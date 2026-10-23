import { describe, it, expect } from 'vitest'
import { navigationItems, isNavGroup } from '@/data/navigation'

const leaves = navigationItems.flatMap((e) => (isNavGroup(e) ? e.items : [e]))
const group = (title: string) =>
  navigationItems.find((e) => isNavGroup(e) && e.title === title)

describe('navigationItems', () => {
  it('includes a Nutrition leaf linking to /nutrition', () => {
    expect(leaves.some((l) => l.href === '/nutrition')).toBe(true)
  })

  it('calls the AI chat "Chat" and the profile page "Profile"', () => {
    expect(leaves.find((l) => l.href === '/insights')?.title).toBe('Chat')
    expect(leaves.find((l) => l.href === '/profile')?.title).toBe('Profile')
  })

  it('lists blood test import under Results', () => {
    const results = group('Results')
    expect(results && isNavGroup(results) && results.items.map((i) => i.href)).toContain('/import')
    expect(leaves.filter((l) => l.href === '/import')).toHaveLength(1)
  })

  it('groups Profile and Stack under Account', () => {
    const account = group('Account')
    expect(account && isNavGroup(account) && account.items.map((i) => i.title)).toEqual([
      'Profile',
      'Stack',
    ])
  })

  it('has no leftover "New" badges', () => {
    expect(leaves.some((l) => l.badge === 'New')).toBe(false)
  })
})
