'use server'

import { redirect } from 'next/navigation'

import { requireAdmin } from '@/lib/auth/require-admin'
import { getSessionUser } from '@/lib/supabase/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canImpersonate, CONSENT_ONLY_BY_USER } from '@/lib/auth/impersonation-guards'
import {
  mintSessionFor,
  getActiveImpersonation,
  setImpersonationCookie,
  clearImpersonationCookie,
} from '@/lib/auth/impersonation'
import type { ImpersonationSessionRow } from '@/lib/database.types'

export interface ImpersonationUser {
  id: string
  email: string
  role: string
  impersonatable: boolean
}

/** Admin-only: list candidate users from `profiles`, enriched with email + role. */
export async function listImpersonationUsers(): Promise<
  { data: ImpersonationUser[]; error: null } | { data: null; error: string }
> {
  const admin = await requireAdmin()
  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, impersonatable')
    .order('created_at', { ascending: true })
  if (error) return { data: null, error: error.message }

  // Resolve emails/roles concurrently — the getUserById calls are independent.
  const profileRows = (profiles ?? []) as { id: string; impersonatable: boolean }[]
  const authResults = await Promise.all(
    profileRows.map((p) => supabaseAdmin.auth.admin.getUserById(p.id))
  )
  const users: ImpersonationUser[] = profileRows.map((p, i) => {
    const authData = authResults[i].data
    return {
      id: p.id,
      email: authData?.user?.email ?? '(no email)',
      role: (authData?.user?.app_metadata as { role?: string })?.role ?? 'user',
      impersonatable: p.impersonatable,
    }
  })
  users.sort((a, b) => (a.id === admin.id ? -1 : b.id === admin.id ? 1 : 0))
  return { data: users, error: null }
}

/**
 * Admin-only: withdraw a user's consent to impersonation. Consent itself can
 * only come from the user ({@link setOwnImpersonationConsent}): an admin
 * reading someone's health data needs that person's permission.
 */
export async function setImpersonatable(
  userId: string,
  value: boolean
): Promise<{ error: string | null }> {
  await requireAdmin()
  if (value) return { error: CONSENT_ONLY_BY_USER }
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ impersonatable: false })
    .eq('id', userId)
  if (error) return { error: error.message }
  const ended = await endOpenSessions(userId)
  return { error: ended.error }
}

/** Close the audit rows of any admin session still open for `userId`. */
async function endOpenSessions(
  userId: string
): Promise<{ error: string | null; ended?: number }> {
  const { data, error } = await supabaseAdmin
    .from('impersonation_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('target_user_id', userId)
    .is('ended_at', null)
    .select('id')
  return { error: error?.message ?? null, ended: (data ?? []).length }
}

/**
 * The signed-in user allows (or stops allowing) the admin to sign in as them.
 * Refused during an impersonation session, so an admin acting as the user
 * cannot give that consent on the user's behalf.
 */
export async function setOwnImpersonationConsent(
  value: boolean
): Promise<{ error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'You must be signed in.' }
  if (await getActiveImpersonation()) {
    return { error: 'This setting cannot be changed while an admin is signed in as you.' }
  }
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ impersonatable: value })
    .eq('id', user.id)
  if (error) return { error: error.message }
  if (value) return { error: null }

  // Withdrawing consent ends an admin session that is still open. The admin
  // holds a real session for this account, so closing the audit row is not
  // enough: sign out every other session of this user as well.
  const ended = await endOpenSessions(user.id)
  if (ended.error) return { error: ended.error }
  if (ended.ended) {
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' })
    if (signOutError) return { error: signOutError.message }
  }
  return { error: null }
}

/** Admin-only: switch into a flagged user. Redirects to /dashboard on success. */
export async function startImpersonation(
  targetUserId: string
): Promise<{ error: string } | void> {
  const admin = await requireAdmin()

  if (await getActiveImpersonation()) {
    return { error: 'Already impersonating. Exit first.' }
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, impersonatable')
    .eq('id', targetUserId)
    .maybeSingle()
  const { data: authData } = await supabaseAdmin.auth.admin.getUserById(targetUserId)

  const guard = canImpersonate(
    {
      id: targetUserId,
      email: authData?.user?.email ?? null,
      role: (authData?.user?.app_metadata as { role?: string })?.role ?? 'user',
      impersonatable: (profile as { impersonatable?: boolean } | null)?.impersonatable ?? false,
    },
    admin.id
  )
  if (!guard.ok) return { error: guard.reason }

  const { data: row, error: insErr } = await supabaseAdmin
    .from('impersonation_sessions')
    .insert({ admin_user_id: admin.id, target_user_id: targetUserId })
    .select('id')
    .single()
  if (insErr || !row) return { error: 'Failed to start impersonation.' }

  const mint = await mintSessionFor(authData!.user!.email!)
  if (!mint.ok) {
    await supabaseAdmin.from('impersonation_sessions').delete().eq('id', row.id)
    return { error: `Could not switch session: ${mint.error}` }
  }

  await setImpersonationCookie(row.id as string)
  redirect('/dashboard')
}

/** Restore the admin's session. Authorized by the imp_sid cookie + active row. */
export async function stopImpersonation(): Promise<{ error: string } | void> {
  const active = await getActiveImpersonation()
  if (!active) {
    await clearImpersonationCookie()
    redirect('/login')
    return
  }

  const { data: adminAuth } = await supabaseAdmin.auth.admin.getUserById(active.adminId)
  const adminEmail = adminAuth?.user?.email
  if (!adminEmail) return { error: 'Could not resolve the admin account to restore.' }

  const mint = await mintSessionFor(adminEmail)
  if (!mint.ok) return { error: `Could not restore your session: ${mint.error}` }

  // Admin session is restored (priority). Close the audit row; if this fails the
  // admin is still safely back, but log it so the orphaned active row is
  // observable (and cleanable via forceEndImpersonation) rather than silent.
  const { error: closeError } = await supabaseAdmin
    .from('impersonation_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', active.rowId)
  if (closeError) {
    console.error(
      `[impersonation] failed to close session row ${active.rowId}: ${closeError.message}`
    )
  }
  await clearImpersonationCookie()
  redirect('/admin/users')
}

/** Admin-only: list impersonation history (audit). */
export async function listImpersonationSessions(): Promise<
  { data: ImpersonationSessionRow[]; error: null } | { data: null; error: string }
> {
  await requireAdmin()
  const { data, error } = await supabaseAdmin
    .from('impersonation_sessions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(50)
  if (error) return { data: null, error: error.message }
  return { data: (data ?? []) as ImpersonationSessionRow[], error: null }
}

/** Admin-only: force-close a dangling active session (e.g. after a signOut). */
export async function forceEndImpersonation(rowId: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const { error } = await supabaseAdmin
    .from('impersonation_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', rowId)
    .is('ended_at', null)
  return { error: error?.message ?? null }
}
