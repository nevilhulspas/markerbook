import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/database.generated'

export interface AuditEntry {
  userId: string
  action: 'create' | 'update' | 'archive' | 'delete' | 'approve' | 'reject' | 'verify'
  entityType:
    | 'biomarker'
    | 'biomarker_unit'
    | 'reference_range'
    | 'marker_suggestion'
  entityId: string | null
  changes: Record<string, unknown>
}

/**
 * Append an admin audit-log row. Server-only on purpose: it writes with the
 * service role and trusts the caller's `userId`, so it must never be a server
 * action (every export of a 'use server' file is a public endpoint).
 */
export async function writeAuditLog(
  entry: AuditEntry
): Promise<{ success: true } | { success: false; error: string }> {
  const { error } = await supabaseAdmin.from('audit_logs').insert({
    user_id: entry.userId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    // Callers pass plain row snapshots; the column is jsonb.
    changes: entry.changes as Json,
    created_at: new Date().toISOString(),
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
