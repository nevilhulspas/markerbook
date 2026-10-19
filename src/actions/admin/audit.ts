'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'

export type AuditLogRow = {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string | null
  changes: Record<string, unknown>
  created_at: string
}

export async function getAuditLogs(params: {
  entityType?: string
  limit?: number
}): Promise<{ data: AuditLogRow[] | null; error: string | null }> {
  await requireAdmin()

  let query = supabaseAdmin
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 50)

  if (params.entityType) {
    query = query.eq('entity_type', params.entityType)
  }

  const { data, error } = await query

  return { data: data as AuditLogRow[] | null, error: error?.message ?? null }
}
