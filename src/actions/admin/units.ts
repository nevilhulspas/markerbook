'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { createUnitSchema } from '@/lib/validations/biomarker'
import type { CreateUnitValues } from '@/lib/validations/biomarker'
import type { BiomarkerUnit } from '@/lib/database.types'

function revalidateAll() {
  revalidatePath('/admin/biomarkers')
  revalidatePath('/biomarkers')
  revalidatePath('/grid')
}

export async function getUnitsForBiomarker(
  biomarkerId: string
): Promise<{ data: BiomarkerUnit[]; error: string | null }> {
  await requireAdmin()

  const { data, error } = await supabaseAdmin
    .from('biomarker_units')
    .select('*')
    .eq('biomarker_id', biomarkerId)
    .order('is_default', { ascending: false })

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: (data ?? []) as BiomarkerUnit[], error: null }
}

export async function createUnit(
  input: CreateUnitValues
): Promise<{ success: true; unitId: string } | { success: false; error: string }> {
  const admin = await requireAdmin()

  const validation = createUnitSchema.safeParse(input)
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues.map((err) => err.message).join(', '),
    }
  }
  const parsed = validation.data

  const { data, error } = await supabaseAdmin
    .from('biomarker_units')
    .insert({
      biomarker_id: parsed.biomarker_id,
      unit: parsed.unit,
      is_default: parsed.is_default,
      conversion_factor: parsed.conversion_factor,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Failed to create unit' }
  }

  await writeAuditLog({
    userId: admin.id,
    action: 'create',
    entityType: 'biomarker_unit',
    entityId: data.id,
    changes: input,
  })

  revalidateAll()
  return { success: true, unitId: data.id }
}

export async function deleteUnit(
  unitId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const admin = await requireAdmin()

  const { error } = await supabaseAdmin
    .from('biomarker_units')
    .delete()
    .eq('id', unitId)

  if (error) {
    return { success: false, error: error.message }
  }

  await writeAuditLog({
    userId: admin.id,
    action: 'delete',
    entityType: 'biomarker_unit',
    entityId: unitId,
    changes: { deleted: true },
  })

  revalidateAll()
  return { success: true }
}
