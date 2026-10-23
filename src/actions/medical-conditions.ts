'use server'

// CRUD for the per-user medical_conditions list.
//
// All writes go through the user-context Supabase client; RLS (auth.uid() =
// user_id) does the enforcement. Mirrors the next_to_test action pattern
// rather than the legacy profile-via-admin-client pattern.

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { userErrorMessage } from '@/lib/supabase/errors'
import { medicalConditionSchema } from '@/lib/validations/profile'
import type { MedicalCondition } from '@/lib/database.types'

// Discriminated by `kind` (not `error`) so `'invalid'` doesn't collide with
// the DB-fail variant where `error` is an arbitrary message string.
export type AuthFail = { ok: false; kind: 'unauthorized' }
export type ValidationFail = {
  ok: false
  kind: 'invalid'
  details: string[]
}
export type DbFail = { ok: false; kind: 'db'; error: string }
export type WriteResult =
  | { ok: true; data: MedicalCondition }
  | AuthFail
  | ValidationFail
  | DbFail

// Coerce empty strings to null so the DB stores explicit NULL rather than ''.
function emptyToNull(v: string | undefined): string | null {
  if (typeof v !== 'string') return null
  return v.trim() === '' ? null : v.trim()
}

export async function getMedicalConditions(): Promise<MedicalCondition[]> {
  const { supabase, user } = await getSessionUser()
  if (!user) return []
  const { data } = await supabase
    .from('medical_conditions')
    .select('*')
    .eq('user_id', user.id)
    // Ongoing conditions (NULL end_date) bubble up first via start_date desc;
    // resolved conditions fall below in reverse chronological order.
    .order('end_date', { ascending: false, nullsFirst: true })
    .order('start_date', { ascending: false, nullsFirst: false })
  return (data ?? []) as MedicalCondition[]
}

export async function addMedicalCondition(values: unknown): Promise<WriteResult> {
  const parsed = medicalConditionSchema.safeParse(values)
  if (!parsed.success) {
    return {
      ok: false,
      kind: 'invalid',
      details: parsed.error.issues.map((i) => i.message),
    }
  }
  const { supabase, user } = await getSessionUser()
  if (!user) return { ok: false, kind: 'unauthorized' }

  const { data, error } = await supabase
    .from('medical_conditions')
    .insert({
      user_id: user.id,
      condition_name: parsed.data.condition_name.trim(),
      start_date: emptyToNull(parsed.data.start_date),
      end_date: emptyToNull(parsed.data.end_date),
      notes: emptyToNull(parsed.data.notes),
    })
    .select()
    .single()

  if (error) {
    return {
      ok: false,
      kind: 'db',
      error: userErrorMessage(
        'addMedicalCondition',
        error,
        'Could not save the condition. Please try again.'
      ),
    }
  }
  revalidatePath('/profile')
  return { ok: true, data: data as MedicalCondition }
}

export async function updateMedicalCondition(
  id: string,
  values: unknown
): Promise<WriteResult> {
  const parsed = medicalConditionSchema.safeParse(values)
  if (!parsed.success) {
    return {
      ok: false,
      kind: 'invalid',
      details: parsed.error.issues.map((i) => i.message),
    }
  }
  const { supabase, user } = await getSessionUser()
  if (!user) return { ok: false, kind: 'unauthorized' }

  // `.select().single()` so PostgREST returns PGRST116 if no row matched
  // (id wrong or row belongs to another user); avoids a silent ok on
  // non-existent ids.
  const { data, error } = await supabase
    .from('medical_conditions')
    .update({
      condition_name: parsed.data.condition_name.trim(),
      start_date: emptyToNull(parsed.data.start_date),
      end_date: emptyToNull(parsed.data.end_date),
      notes: emptyToNull(parsed.data.notes),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return {
      ok: false,
      kind: 'db',
      error: userErrorMessage(
        'updateMedicalCondition',
        error,
        'Could not save the condition. Please try again.'
      ),
    }
  }
  revalidatePath('/profile')
  return { ok: true, data: data as MedicalCondition }
}

export async function deleteMedicalCondition(
  id: string
): Promise<{ ok: true } | AuthFail | DbFail> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { ok: false, kind: 'unauthorized' }

  const { error } = await supabase
    .from('medical_conditions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return {
      ok: false,
      kind: 'db',
      error: userErrorMessage(
        'deleteMedicalCondition',
        error,
        'Could not delete the condition. Please try again.'
      ),
    }
  }
  revalidatePath('/profile')
  return { ok: true }
}
