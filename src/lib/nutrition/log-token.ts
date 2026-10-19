import { supabaseAdmin } from '@/lib/supabase/admin'

/** Resolves the profile owner for a Shortcut logging token (admin, bypasses RLS). */
export async function resolveUserIdByToken(token: string | null): Promise<string | null> {
  if (!token) return null
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('nutrition_log_token', token)
    .maybeSingle()
  if (error || !data) return null
  return (data as { id: string }).id
}
