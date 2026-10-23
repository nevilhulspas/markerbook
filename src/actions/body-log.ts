'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/session'
import { userErrorMessage } from '@/lib/supabase/errors'
import { bodyLogEntrySchema, type BodyLogInput } from '@/lib/validations/body-log'
import type { BodyLogEntry } from '@/lib/database.types'

/** All of the signed-in user's manual log entries, newest first (RLS-scoped). */
export async function getLogEntries(): Promise<BodyLogEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('body_log_entries')
    .select('*')
    .order('logged_on', { ascending: false })
  // Throw rather than return [] so the page shows an error instead of
  // "no data" (dashboard error.tsx).
  if (error) {
    console.error('getLogEntries failed:', error.message)
    throw new Error(`Could not load your data (getLogEntries): ${error.message}`)
  }
  return (data ?? []) as BodyLogEntry[]
}

export async function saveLogEntry(input: BodyLogInput): Promise<{ error: string | null }> {
  const parsed = bodyLogEntrySchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid entry' }
  }

  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'You must be signed in.' }

  const { error } = await supabase.from('body_log_entries').insert({
    user_id: user.id,
    logged_on: parsed.data.logged_on,
    weight_kg: parsed.data.weight_kg ?? null,
    body_fat_pct: parsed.data.body_fat_pct ?? null,
    waist_cm: parsed.data.waist_cm ?? null,
    notes: parsed.data.notes ?? null,
  })
  if (error) {
    return {
      error: userErrorMessage('saveLogEntry', error, 'Could not save the entry. Please try again.'),
    }
  }
  revalidatePath('/body')
  return { error: null }
}

export async function deleteLogEntry(id: string): Promise<{ error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'You must be signed in.' }

  const { error } = await supabase.from('body_log_entries').delete().eq('id', id)
  if (error) {
    return {
      error: userErrorMessage(
        'deleteLogEntry',
        error,
        'Could not delete the entry. Please try again.'
      ),
    }
  }
  revalidatePath('/body')
  return { error: null }
}
