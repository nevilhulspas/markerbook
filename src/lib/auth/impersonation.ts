import 'server-only'

import { cookies } from 'next/headers'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const IMP_COOKIE = 'imp_sid'

export interface ActiveImpersonation {
  rowId: string
  adminId: string
  targetId: string
  targetEmail: string
}

/**
 * Mint and install a Supabase session for `email` into the current request's
 * cookies (the SSR client's setAll writes them). No email is sent — generateLink
 * just returns a one-time token we immediately verify.
 *
 * NOTE: if `verifyOtp` rejects the magiclink token with type 'email', switch the
 * type to 'magiclink' (auth-js EmailOtpType accepts both for magic links).
 */
export async function mintSessionFor(
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const tokenHash = data?.properties?.hashed_token
  if (error || !tokenHash) {
    return { ok: false, error: error?.message ?? 'Failed to generate session link' }
  }
  const supabase = await createClient()
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email',
  })
  if (verifyError) return { ok: false, error: verifyError.message }
  return { ok: true }
}

/**
 * Read the active impersonation for the current request, or null. Defensive:
 * requires a matching active row AND that the live session user IS the target.
 */
export async function getActiveImpersonation(): Promise<ActiveImpersonation | null> {
  const cookieStore = await cookies()
  const sid = cookieStore.get(IMP_COOKIE)?.value
  if (!sid) return null

  const { data: row } = await supabaseAdmin
    .from('impersonation_sessions')
    .select('id, admin_user_id, target_user_id, ended_at')
    .eq('id', sid)
    .is('ended_at', null)
    .maybeSingle()
  if (!row) return null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.id !== row.target_user_id) return null

  const { data: target } = await supabaseAdmin.auth.admin.getUserById(row.target_user_id)
  return {
    rowId: row.id as string,
    adminId: row.admin_user_id as string,
    targetId: row.target_user_id as string,
    targetEmail: target?.user?.email ?? '',
  }
}

export async function setImpersonationCookie(rowId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(IMP_COOKIE, rowId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8h — bounds orphaned audit rows if the browser closes mid-session
  })
}

export async function clearImpersonationCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(IMP_COOKIE)
}
