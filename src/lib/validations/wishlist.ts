import { z } from 'zod'

import type { WishlistItemWithSources } from '@/lib/database.types'

const emptyToUndefined = (v: unknown) => (v === '' || v == null ? undefined : v)

export const wishlistSourceSchema = z.object({
  brand: z.string().max(200, 'Brand must be at most 200 characters').optional(),
  url: z.preprocess(
    emptyToUndefined,
    z.string().url('Enter a valid URL').max(2000).optional()
  ),
  price: z.preprocess(
    emptyToUndefined,
    z.coerce.number().nonnegative('Price must be zero or positive').optional()
  ),
  currency: z.string().max(8).optional(),
})

export const wishlistItemSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(200, 'Name must be at most 200 characters'),
  priority: z.enum(['high', 'medium', 'low']).nullable().optional(),
  notes: z.string().max(1000, 'Notes must be at most 1000 characters').optional(),
})

/** Item create payload that may carry inline sources (used by the chat tool). */
export const createWishlistItemSchema = wishlistItemSchema.extend({
  sources: z.array(wishlistSourceSchema).optional(),
})

export type WishlistItemValues = z.infer<typeof wishlistItemSchema>
export type WishlistSourceValues = z.infer<typeof wishlistSourceSchema>

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }

/** Sort by priority (high→low, nulls last), then name (case-insensitive). Pure. */
export function sortWishlist(
  items: WishlistItemWithSources[]
): WishlistItemWithSources[] {
  return [...items].sort((a, b) => {
    const ra = a.priority ? PRIORITY_RANK[a.priority] : 3
    const rb = b.priority ? PRIORITY_RANK[b.priority] : 3
    if (ra !== rb) return ra - rb
    return a.name.localeCompare(b.name)
  })
}
