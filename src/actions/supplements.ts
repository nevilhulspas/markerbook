'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { userErrorMessage } from '@/lib/supabase/errors'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  createSupplementSchema,
  updateSupplementSchema,
} from '@/lib/validations/supplement'
import { normalizeTime } from '@/lib/supplements/intake'
import { replaceSupplementIntakes } from '@/lib/supplements/replace-intakes'
import type { Supplement, SupplementWithIntakes } from '@/lib/database.types'
import type { TableUpdate } from '@/lib/supabase/database'
import { appTodayISO } from '@/lib/dates/today'

/** The embedded-intakes shape returned by the `select` below. */
type IntakeSelect = { time_of_day: string; amount: string | null }

const INTAKE_SELECT = '*, intakes:supplement_intakes(time_of_day, amount)'

/**
 * Supabase returns the embedded intakes under the alias used in `select`, with
 * times as Postgres "HH:MM:SS". Normalizing here, once, means no consumer has
 * to remember to do it. Module-local: a `'use server'` file may only export
 * async functions.
 */
function mapSupplementRow(row: unknown): SupplementWithIntakes {
  const r = row as Supplement & { intakes?: IntakeSelect[] | null }
  const intakes = (r.intakes ?? [])
    .map((i) => ({ time: normalizeTime(i.time_of_day), amount: i.amount }))
    .sort((a, b) => a.time.localeCompare(b.time))
  return { ...(r as Supplement), intakes }
}

export async function getSupplements(): Promise<
  { data: SupplementWithIntakes[]; error: null } | { data: null; error: string }
> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { data: null, error: authError ?? 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('supplements')
    .select(INTAKE_SELECT)
    .order('start_date', { ascending: false })

  if (error) {
    return {
      data: null,
      error: userErrorMessage(
        'getSupplements',
        error,
        'Could not load your supplements. Please try again.'
      ),
    }
  }

  return { data: (data ?? []).map(mapSupplementRow), error: null }
}

export async function getActiveSupplements(): Promise<
  { data: SupplementWithIntakes[]; error: null } | { data: null; error: string }
> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { data: null, error: authError ?? 'Not authenticated' }
  }

  // Active = started on or before today AND not stopped. A future start_date
  // is "upcoming" (see matchesSupplementMode) and must not count as active —
  // the profile card's count would overstate the current stack.
  const today = appTodayISO()
  const { data, error } = await supabase
    .from('supplements')
    .select(INTAKE_SELECT)
    .lte('start_date', today)
    .is('end_date', null)
    .order('start_date', { ascending: true })

  if (error) {
    return {
      data: null,
      error: userErrorMessage(
        'getActiveSupplements',
        error,
        'Could not load your supplements. Please try again.'
      ),
    }
  }

  return { data: (data ?? []).map(mapSupplementRow), error: null }
}

/**
 * The supplements on one schedule list, filtered in SQL. `active` started on or
 * before today and has not stopped; `upcoming` starts later. Used by the PDF
 * export, which would otherwise fetch every stopped entry just to discard it.
 */
export async function getScheduleSupplements(
  mode: 'active' | 'upcoming'
): Promise<
  { data: SupplementWithIntakes[]; error: null } | { data: null; error: string }
> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { data: null, error: authError ?? 'Not authenticated' }
  }

  const today = appTodayISO()
  let query = supabase.from('supplements').select(INTAKE_SELECT).is('end_date', null)
  query =
    mode === 'active'
      ? query.lte('start_date', today)
      : query.gt('start_date', today)

  const { data, error } = await query.order('name', { ascending: true })

  if (error) {
    return {
      data: null,
      error: userErrorMessage(
        'getScheduleSupplements',
        error,
        'Could not load your supplements. Please try again.'
      ),
    }
  }

  return { data: (data ?? []).map(mapSupplementRow), error: null }
}

export async function createSupplement(
  values: unknown
): Promise<
  | { success: true; supplement: SupplementWithIntakes; error: null }
  | { success: false; supplement: null; error: string }
> {
  const parsed = createSupplementSchema.safeParse(values)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    return {
      success: false,
      supplement: null,
      error: `Invalid supplement data: ${issues}`,
    }
  }

  const { user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, supplement: null, error: authError ?? 'Not authenticated' }
  }

  const { data, error } = await supabaseAdmin
    .from('supplements')
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      dose: parsed.data.dose ?? null,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select(INTAKE_SELECT)
    .single()

  if (error) {
    return {
      success: false,
      supplement: null,
      error: userErrorMessage(
        'createSupplement',
        error,
        'Could not save the supplement. Please try again.'
      ),
    }
  }

  const created = mapSupplementRow(data)

  if (parsed.data.intakes && parsed.data.intakes.length > 0) {
    const intakeError = await replaceSupplementIntakes(
      supabaseAdmin,
      created.id,
      user.id,
      parsed.data.intakes
    )
    if (intakeError) {
      return { success: false, supplement: null, error: intakeError }
    }
    created.intakes = parsed.data.intakes.map((i) => ({
      time: i.time,
      amount: i.amount ?? null,
    }))
  }

  revalidatePath('/supplements')
  revalidatePath('/grid')
  return { success: true, supplement: created, error: null }
}

export async function updateSupplement(
  id: string,
  values: unknown
): Promise<
  | { success: true; supplement: SupplementWithIntakes; error: null }
  | { success: false; supplement: null; error: string }
> {
  const parsed = updateSupplementSchema.safeParse(values)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    return {
      success: false,
      supplement: null,
      error: `Invalid supplement data: ${issues}`,
    }
  }

  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, supplement: null, error: authError ?? 'Not authenticated' }
  }

  // Verify ownership via RLS read
  const { data: existing } = await supabase
    .from('supplements')
    .select('id')
    .eq('id', id)
    .single()

  if (!existing) {
    return { success: false, supplement: null, error: 'Supplement not found' }
  }

  const updateData: TableUpdate<'supplements'> = {
    updated_at: new Date().toISOString(),
  }
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.dose !== undefined) updateData.dose = parsed.data.dose
  if (parsed.data.start_date !== undefined) updateData.start_date = parsed.data.start_date
  if (parsed.data.end_date !== undefined) updateData.end_date = parsed.data.end_date
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes

  const { data, error } = await supabaseAdmin
    .from('supplements')
    .update(updateData)
    .eq('id', id)
    .select(INTAKE_SELECT)
    .single()

  if (error) {
    return {
      success: false,
      supplement: null,
      error: userErrorMessage(
        'updateSupplement',
        error,
        'Could not save the supplement. Please try again.'
      ),
    }
  }

  const updated = mapSupplementRow(data)

  // Providing the array replaces every moment; omitting it leaves them alone.
  if (parsed.data.intakes !== undefined) {
    const intakeError = await replaceSupplementIntakes(
      supabaseAdmin,
      id,
      user.id,
      parsed.data.intakes
    )
    if (intakeError) {
      return { success: false, supplement: null, error: intakeError }
    }
    updated.intakes = parsed.data.intakes.map((i) => ({
      time: i.time,
      amount: i.amount ?? null,
    }))
  }

  revalidatePath('/supplements')
  revalidatePath('/grid')
  return { success: true, supplement: updated, error: null }
}

export async function deleteSupplement(
  id: string
): Promise<{ success: true; error: null } | { success: false; error: string }> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, error: authError ?? 'Not authenticated' }
  }

  // Verify ownership via RLS read
  const { data: existing } = await supabase
    .from('supplements')
    .select('id')
    .eq('id', id)
    .single()

  if (!existing) {
    return { success: false, error: 'Supplement not found' }
  }

  const { error } = await supabaseAdmin
    .from('supplements')
    .delete()
    .eq('id', id)

  if (error) {
    return {
      success: false,
      error: userErrorMessage(
        'deleteSupplement',
        error,
        'Could not delete the supplement. Please try again.'
      ),
    }
  }

  revalidatePath('/supplements')
  revalidatePath('/grid')
  return { success: true, error: null }
}
