import { describe, it, expect } from 'vitest'
import {
  wishlistItemSchema,
  wishlistSourceSchema,
  sortWishlist,
} from '../wishlist'
import type { WishlistItemWithSources } from '@/lib/database.types'

describe('wishlistItemSchema', () => {
  it('accepts a name with optional priority', () => {
    expect(wishlistItemSchema.safeParse({ name: 'Magnesium', priority: 'high' }).success).toBe(true)
  })
  it('rejects an empty name', () => {
    expect(wishlistItemSchema.safeParse({ name: '' }).success).toBe(false)
  })
  it('rejects an invalid priority', () => {
    expect(wishlistItemSchema.safeParse({ name: 'X', priority: 'urgent' }).success).toBe(false)
  })
})

describe('wishlistSourceSchema', () => {
  it('coerces empty-string url to undefined (valid)', () => {
    const r = wishlistSourceSchema.safeParse({ brand: 'Thorne', url: '', price: 20 })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.url).toBeUndefined()
  })
  it('rejects a malformed url', () => {
    expect(wishlistSourceSchema.safeParse({ url: 'not a url' }).success).toBe(false)
  })
  it('rejects a negative price', () => {
    expect(wishlistSourceSchema.safeParse({ price: -1 }).success).toBe(false)
  })
  it('coerces empty-string price to undefined', () => {
    const r = wishlistSourceSchema.safeParse({ price: '' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.price).toBeUndefined()
  })
})

describe('sortWishlist', () => {
  const mk = (name: string, priority: WishlistItemWithSources['priority']) =>
    ({ id: name, name, priority, sources: [] }) as unknown as WishlistItemWithSources

  it('orders high → medium → low → none, then by name', () => {
    const sorted = sortWishlist([
      mk('B', null), mk('A', 'low'), mk('C', 'high'), mk('A', 'high'),
    ])
    expect(sorted.map((i) => `${i.priority ?? '-'}:${i.name}`)).toEqual([
      'high:A', 'high:C', 'low:A', '-:B',
    ])
  })
})
