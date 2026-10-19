import type { TypedSupabaseClient } from '@/lib/supabase/database'

import { normalizeTime } from '@/lib/supplements/intake'

export type IntakeWrite = { time: string; amount?: string | null }

/**
 * Make a supplement's intake moments exactly `rows`.
 *
 * Upsert-then-prune rather than delete-then-insert: the old rows are only
 * removed once the new ones are safely in, so a failed write can never leave
 * the supplement with no schedule at all. Both statements are scoped by
 * `user_id` as well as `supplement_id` — callers may pass a service-role
 * client, which bypasses RLS, so this must not rely on an ownership check made
 * somewhere up the stack.
 *
 * Returns an error message, or null on success. Shared by the server actions
 * and the in-chat tools so the replacement strategy lives in one place.
 */
export async function replaceSupplementIntakes(
  client: TypedSupabaseClient,
  supplementId: string,
  userId: string,
  rows: IntakeWrite[]
): Promise<string | null> {
  const wanted = rows.map((r) => ({
    supplement_id: supplementId,
    user_id: userId,
    time_of_day: r.time,
    amount: r.amount ?? null,
  }))

  if (wanted.length > 0) {
    const { error } = await client
      .from('supplement_intakes')
      .upsert(wanted, { onConflict: 'supplement_id,time_of_day' })
    if (error) return error.message
  }

  const { data: existing, error: readError } = await client
    .from('supplement_intakes')
    .select('id, time_of_day')
    .eq('supplement_id', supplementId)
    .eq('user_id', userId)
  if (readError) return readError.message

  const keep = new Set(rows.map((r) => normalizeTime(r.time)))
  const stale = (existing ?? [])
    .filter(
      (r) => !keep.has(normalizeTime((r as { time_of_day: string }).time_of_day))
    )
    .map((r) => (r as { id: string }).id)

  if (stale.length > 0) {
    const { error } = await client
      .from('supplement_intakes')
      .delete()
      .in('id', stale)
      .eq('user_id', userId)
    if (error) return error.message
  }

  return null
}
