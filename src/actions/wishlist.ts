'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  wishlistItemSchema,
  wishlistSourceSchema,
  createWishlistItemSchema,
  sortWishlist,
} from '@/lib/validations/wishlist'
import type {
  WishlistItem,
  WishlistSource,
  WishlistItemWithSources,
} from '@/lib/database.types'
import type { TableUpdate } from '@/lib/supabase/database'

async function requireUserId(): Promise<string | null> {
  const { user } = await getSessionUser()
  return user?.id ?? null
}

export async function getWishlist(): Promise<
  { data: WishlistItemWithSources[]; error: null } | { data: null; error: string }
> {
  const userId = await requireUserId()
  if (!userId) return { data: null, error: 'Not authenticated' }

  const { data, error } = await supabaseAdmin
    .from('wishlist_items')
    .select('*, sources:wishlist_sources(*)')
    .eq('user_id', userId)
  if (error) return { data: null, error: error.message }

  return { data: sortWishlist((data ?? []) as WishlistItemWithSources[]), error: null }
}

export async function createWishlistItem(
  values: unknown
): Promise<
  | { success: true; item: WishlistItem; error: null }
  | { success: false; item: null; error: string }
> {
  const parsed = createWishlistItemSchema.safeParse(values)
  if (!parsed.success) {
    return { success: false, item: null, error: parsed.error.issues[0]?.message ?? 'Invalid data' }
  }
  const userId = await requireUserId()
  if (!userId) return { success: false, item: null, error: 'Not authenticated' }

  const { sources, ...item } = parsed.data
  const { data: created, error } = await supabaseAdmin
    .from('wishlist_items')
    .insert({
      user_id: userId,
      name: item.name,
      priority: item.priority ?? null,
      notes: item.notes ?? null,
    })
    .select('*')
    .single()
  if (error || !created) {
    return { success: false, item: null, error: error?.message ?? 'Failed to create item' }
  }

  if (sources && sources.length > 0) {
    const rows = sources.map((s) => ({
      item_id: (created as WishlistItem).id,
      user_id: userId,
      brand: s.brand ?? null,
      url: s.url ?? null,
      price: s.price ?? null,
      currency: s.currency ?? 'EUR',
    }))
    const { error: srcErr } = await supabaseAdmin.from('wishlist_sources').insert(rows)
    if (srcErr) {
      // Roll back the item so we never leave an item with no sources.
      await supabaseAdmin.from('wishlist_items').delete().eq('id', (created as WishlistItem).id)
      return { success: false, item: null, error: `Failed to save sources: ${srcErr.message}` }
    }
  }

  revalidatePath('/supplements')
  return { success: true, item: created as WishlistItem, error: null }
}

export async function updateWishlistItem(
  id: string,
  values: unknown
): Promise<{ success: boolean; error: string | null }> {
  const parsed = wishlistItemSchema.partial().safeParse(values)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' }
  }
  const userId = await requireUserId()
  if (!userId) return { success: false, error: 'Not authenticated' }

  const patch: TableUpdate<'wishlist_items'> = {}
  if (parsed.data.name !== undefined) patch.name = parsed.data.name
  if (parsed.data.priority !== undefined) patch.priority = parsed.data.priority
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes
  patch.updated_at = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('wishlist_items')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/supplements')
  return { success: true, error: null }
}

export async function deleteWishlistItem(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  const userId = await requireUserId()
  if (!userId) return { success: false, error: 'Not authenticated' }
  const { error } = await supabaseAdmin
    .from('wishlist_items')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/supplements')
  return { success: true, error: null }
}

export async function addWishlistSource(
  itemId: string,
  values: unknown
): Promise<
  | { success: true; source: WishlistSource; error: null }
  | { success: false; source: null; error: string }
> {
  const parsed = wishlistSourceSchema.safeParse(values)
  if (!parsed.success) {
    return { success: false, source: null, error: parsed.error.issues[0]?.message ?? 'Invalid data' }
  }
  const userId = await requireUserId()
  if (!userId) return { success: false, source: null, error: 'Not authenticated' }

  const { data: item } = await supabaseAdmin
    .from('wishlist_items')
    .select('id')
    .eq('id', itemId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!item) return { success: false, source: null, error: 'Item not found' }

  const { data, error } = await supabaseAdmin
    .from('wishlist_sources')
    .insert({
      item_id: itemId,
      user_id: userId,
      brand: parsed.data.brand ?? null,
      url: parsed.data.url ?? null,
      price: parsed.data.price ?? null,
      currency: parsed.data.currency ?? 'EUR',
    })
    .select('*')
    .single()
  if (error || !data) {
    return { success: false, source: null, error: error?.message ?? 'Failed to add source' }
  }
  revalidatePath('/supplements')
  return { success: true, source: data as WishlistSource, error: null }
}

export async function updateWishlistSource(
  sourceId: string,
  values: unknown
): Promise<{ success: boolean; error: string | null }> {
  const parsed = wishlistSourceSchema.partial().safeParse(values)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' }
  }
  const userId = await requireUserId()
  if (!userId) return { success: false, error: 'Not authenticated' }

  // Only write columns the caller actually supplied — `.partial()` means an
  // omitted field must be left untouched, not overwritten with null/'EUR'. A
  // field present-but-empty (e.g. the form clearing a brand) still updates,
  // since the key is in the raw input even though preprocess maps '' → undefined.
  const raw = (values ?? {}) as Record<string, unknown>
  const patch: TableUpdate<'wishlist_sources'> = {}
  if ('brand' in raw) patch.brand = parsed.data.brand ?? null
  if ('url' in raw) patch.url = parsed.data.url ?? null
  if ('price' in raw) patch.price = parsed.data.price ?? null
  if ('currency' in raw) patch.currency = parsed.data.currency ?? 'EUR'
  if (Object.keys(patch).length === 0) return { success: true, error: null }

  const { error } = await supabaseAdmin
    .from('wishlist_sources')
    .update(patch)
    .eq('id', sourceId)
    .eq('user_id', userId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/supplements')
  return { success: true, error: null }
}

export async function deleteWishlistSource(
  sourceId: string
): Promise<{ success: boolean; error: string | null }> {
  const userId = await requireUserId()
  if (!userId) return { success: false, error: 'Not authenticated' }
  const { error } = await supabaseAdmin
    .from('wishlist_sources')
    .delete()
    .eq('id', sourceId)
    .eq('user_id', userId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/supplements')
  return { success: true, error: null }
}
