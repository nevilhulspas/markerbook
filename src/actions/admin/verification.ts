'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { verifyRangeSchema } from '@/lib/validations/biomarker'
import type { VerifyRangeValues } from '@/lib/validations/biomarker'
import { parseMayoHtml } from '@/lib/mayo/parser'
import type { MayoParseResult } from '@/lib/mayo/types'

function revalidateAll() {
  revalidatePath('/admin/biomarkers')
  revalidatePath('/biomarkers')
  revalidatePath('/grid')
}

export async function verifyRange(
  id: string,
  input: VerifyRangeValues
): Promise<{ success: true } | { success: false; error: string }> {
  const admin = await requireAdmin()

  const validation = verifyRangeSchema.safeParse(input)
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues.map((err) => err.message).join(', '),
    }
  }
  const parsed = validation.data

  const { error } = await supabaseAdmin
    .from('reference_ranges')
    .update({
      range_low: parsed.range_low,
      range_high: parsed.range_high,
      source: parsed.source,
      source_url: parsed.source_url,
      verified_at: new Date().toISOString(),
      verified_by: admin.id,
    })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  await writeAuditLog({
    userId: admin.id,
    action: 'verify',
    entityType: 'reference_range',
    entityId: id,
    changes: { ...parsed, verified: true },
  })

  revalidateAll()
  return { success: true }
}

export async function extractMayoRanges(html: string): Promise<MayoParseResult> {
  await requireAdmin()
  return parseMayoHtml(html)
}
