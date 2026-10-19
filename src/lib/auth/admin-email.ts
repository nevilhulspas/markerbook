import 'server-only'

import type { User } from '@supabase/supabase-js'

import { supabaseAdmin } from '@/lib/supabase/admin'

/** ADMIN_EMAIL: one or more comma-separated addresses that become admin. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAIL ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Give the admin role to a signed-in user whose confirmed e-mail address is
 * listed in ADMIN_EMAIL. Called after sign-up, password sign-in and the OAuth
 * callback, so the owner of a fresh install never needs a terminal command.
 * Only a confirmed address counts: with e-mail confirmation on, nobody can
 * claim the admin address without access to its mailbox. Returns true when
 * the role was just granted.
 */
export async function promoteIfAdminEmail(user: User | null | undefined): Promise<boolean> {
  if (!user?.email || !user.email_confirmed_at) return false
  if (!adminEmails().includes(user.email.toLowerCase())) return false
  if ((user.app_metadata as { role?: string } | undefined)?.role === 'admin') return false
  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, role: 'admin' },
  })
  if (error) {
    console.error('promoteIfAdminEmail failed:', error.message)
    return false
  }
  return true
}
