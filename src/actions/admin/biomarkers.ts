'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import {
  createBiomarkerSchema,
  updateBiomarkerSchema,
} from '@/lib/validations/biomarker'
import type { CreateBiomarkerValues, UpdateBiomarkerValues } from '@/lib/validations/biomarker'
import type {
  Biomarker,
  BiomarkerUnit,
  ReferenceRange,
  PanelWithSystem,
} from '@/lib/database.types'

export type AdminBiomarker = Biomarker & {
  biomarker_units: BiomarkerUnit[]
  reference_ranges: ReferenceRange[]
  panels: PanelWithSystem | null
}

function revalidateAll() {
  revalidatePath('/admin/biomarkers')
  revalidatePath('/biomarkers')
  revalidatePath('/grid')
}

export async function getAdminBiomarkers(params: {
  showArchived?: boolean
  search?: string
  category?: string
}): Promise<{ data: AdminBiomarker[]; error: string | null }> {
  await requireAdmin()

  let query = supabaseAdmin
    .from('biomarkers')
    .select('*, biomarker_units(*), reference_ranges(*), panels(*, systems(*))')
    .is('parent_id', null)
    .order('name')

  if (!params.showArchived) {
    query = query.is('archived_at', null)
  }

  if (params.search) {
    query = query.ilike('name', `%${params.search}%`)
  }

  if (params.category) {
    query = query.eq('category', params.category)
  }

  const { data, error } = await query

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: (data ?? []) as AdminBiomarker[], error: null }
}

export async function createBiomarker(
  input: CreateBiomarkerValues
): Promise<{ success: true; biomarkerId: string } | { success: false; error: string }> {
  const admin = await requireAdmin()

  const validation = createBiomarkerSchema.safeParse(input)
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues.map((err) => err.message).join(', '),
    }
  }
  const parsed = validation.data

  const { data, error } = await supabaseAdmin
    .from('biomarkers')
    .insert({
      name: parsed.name,
      short_name: parsed.short_name ?? null,
      category: parsed.category,
      unit: parsed.unit,
      description: parsed.description ?? null,
      panel_id: parsed.panel_id ?? null,
      parent_id: parsed.parent_id ?? null,
      variant_name: parsed.variant_name ?? null,
      aliases: parsed.aliases ?? [],
    })
    .select('id')
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Failed to create biomarker' }
  }

  await writeAuditLog({
    userId: admin.id,
    action: 'create',
    entityType: 'biomarker',
    entityId: data.id,
    changes: input,
  })

  revalidateAll()
  return { success: true, biomarkerId: data.id }
}

export async function updateBiomarker(
  id: string,
  input: UpdateBiomarkerValues
): Promise<{ success: true } | { success: false; error: string }> {
  const admin = await requireAdmin()

  const validation = updateBiomarkerSchema.safeParse(input)
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues.map((err) => err.message).join(', '),
    }
  }
  const parsed = validation.data

  const { error } = await supabaseAdmin
    .from('biomarkers')
    .update(parsed)
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  await writeAuditLog({
    userId: admin.id,
    action: 'update',
    entityType: 'biomarker',
    entityId: id,
    changes: input,
  })

  revalidateAll()
  return { success: true }
}

export async function archiveBiomarker(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const admin = await requireAdmin()

  const { error } = await supabaseAdmin
    .from('biomarkers')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  await writeAuditLog({
    userId: admin.id,
    action: 'archive',
    entityType: 'biomarker',
    entityId: id,
    changes: { archived: true },
  })

  revalidateAll()
  return { success: true }
}

export async function restoreBiomarker(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const admin = await requireAdmin()

  const { error } = await supabaseAdmin
    .from('biomarkers')
    .update({ archived_at: null })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  await writeAuditLog({
    userId: admin.id,
    action: 'update',
    entityType: 'biomarker',
    entityId: id,
    changes: { restored: true },
  })

  revalidateAll()
  return { success: true }
}
