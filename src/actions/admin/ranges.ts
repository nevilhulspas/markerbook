'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { createRangeSchema } from '@/lib/validations/biomarker'
import type { CreateRangeValues } from '@/lib/validations/biomarker'
import type { ParsedRange } from '@/lib/validations/csv-ranges'
import { CSV_RANGE_HEADERS } from '@/lib/validations/csv-ranges'
import { escapeCsv } from '@/lib/export/export-csv'
import type { ReferenceRange } from '@/lib/database.types'

function revalidateAll() {
  revalidatePath('/admin/biomarkers')
  revalidatePath('/biomarkers')
  revalidatePath('/grid')
}

export async function getRangesForBiomarker(
  biomarkerId: string
): Promise<{ data: ReferenceRange[]; error: string | null }> {
  await requireAdmin()

  const { data, error } = await supabaseAdmin
    .from('reference_ranges')
    .select('*')
    .eq('biomarker_id', biomarkerId)
    .order('unit')
    .order('sex')

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: (data ?? []) as ReferenceRange[], error: null }
}

export async function createRange(
  input: CreateRangeValues
): Promise<{ success: true; rangeId: string } | { success: false; error: string }> {
  const admin = await requireAdmin()

  const validation = createRangeSchema.safeParse(input)
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues.map((err) => err.message).join(', '),
    }
  }
  const parsed = validation.data

  const { data, error } = await supabaseAdmin
    .from('reference_ranges')
    .insert({
      biomarker_id: parsed.biomarker_id,
      unit: parsed.unit,
      sex: parsed.sex,
      age_min: parsed.age_min ?? null,
      age_max: parsed.age_max ?? null,
      range_low: parsed.range_low,
      range_high: parsed.range_high,
      source: parsed.source,
      range_type: parsed.range_type,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Failed to create range' }
  }

  await writeAuditLog({
    userId: admin.id,
    action: 'create',
    entityType: 'reference_range',
    entityId: data.id,
    changes: input,
  })

  revalidateAll()
  return { success: true, rangeId: data.id }
}

export async function updateRange(
  id: string,
  input: Partial<CreateRangeValues>
): Promise<{ success: true } | { success: false; error: string }> {
  const admin = await requireAdmin()

  const { error } = await supabaseAdmin
    .from('reference_ranges')
    .update(input)
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  await writeAuditLog({
    userId: admin.id,
    action: 'update',
    entityType: 'reference_range',
    entityId: id,
    changes: input,
  })

  revalidateAll()
  return { success: true }
}

export async function deleteRange(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const admin = await requireAdmin()

  const { error } = await supabaseAdmin
    .from('reference_ranges')
    .delete()
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  await writeAuditLog({
    userId: admin.id,
    action: 'delete',
    entityType: 'reference_range',
    entityId: id,
    changes: { deleted: true },
  })

  revalidateAll()
  return { success: true }
}

export async function bulkImportRanges(
  ranges: ParsedRange[]
): Promise<
  { success: true; imported: number; skipped: number } | { success: false; error: string }
> {
  const admin = await requireAdmin()

  // Fetch all active biomarker names for resolution
  const { data: biomarkers, error: fetchError } = await supabaseAdmin
    .from('biomarkers')
    .select('id, name')
    .is('archived_at', null)

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

  // Build case-insensitive name->id map
  const nameToId = new Map<string, string>()
  for (const b of biomarkers ?? []) {
    nameToId.set((b as { id: string; name: string }).name.toLowerCase(), (b as { id: string; name: string }).id)
  }

  // Resolve names to IDs
  const unresolved: string[] = []
  const resolvedRows: Array<{
    biomarker_id: string
    unit: string
    sex: string
    age_min: number | null
    age_max: number | null
    range_low: number | null
    range_high: number | null
    source: string
    range_type: string
  }> = []

  for (const range of ranges) {
    const biomarkerId = nameToId.get(range.biomarker_name.toLowerCase())
    if (!biomarkerId) {
      unresolved.push(range.biomarker_name)
      continue
    }

    resolvedRows.push({
      biomarker_id: biomarkerId,
      unit: range.unit,
      sex: range.sex,
      age_min: range.age_min ? parseInt(range.age_min, 10) : null,
      age_max: range.age_max ? parseInt(range.age_max, 10) : null,
      range_low: range.range_low ? parseFloat(range.range_low) : null,
      range_high: range.range_high ? parseFloat(range.range_high) : null,
      source: range.source,
      range_type: range.range_type,
    })
  }

  if (unresolved.length > 0) {
    return {
      success: false,
      error: `Unresolved biomarkers: ${unresolved.join(', ')}`,
    }
  }

  if (resolvedRows.length === 0) {
    return { success: true, imported: 0, skipped: 0 }
  }

  // Upsert using the unique index
  const { error: upsertError } = await supabaseAdmin
    .from('reference_ranges')
    .upsert(resolvedRows, { ignoreDuplicates: false })

  if (upsertError) {
    return { success: false, error: upsertError.message }
  }

  await writeAuditLog({
    userId: admin.id,
    action: 'create',
    entityType: 'reference_range',
    entityId: null,
    changes: { bulk_import: true, count: resolvedRows.length },
  })

  revalidateAll()
  return { success: true, imported: resolvedRows.length, skipped: 0 }
}

interface RangeWithBiomarker extends ReferenceRange {
  biomarkers: { name: string }
}

export async function exportRangesCsv(
  biomarkerId?: string
): Promise<{ data: string; error: string | null }> {
  await requireAdmin()

  let query = supabaseAdmin
    .from('reference_ranges')
    .select('*, biomarkers(name)')

  if (biomarkerId) {
    query = query.eq('biomarker_id', biomarkerId)
  }

  const { data, error } = await query

  if (error) {
    return { data: '', error: error.message }
  }

  const rows = (data ?? []) as RangeWithBiomarker[]

  // Build CSV
  const headers = [...CSV_RANGE_HEADERS]
  const lines: string[] = [headers.map(escapeCsv).join(',')]

  for (const row of rows) {
    const values = [
      row.biomarkers?.name ?? '',
      row.unit,
      row.sex,
      row.age_min != null ? String(row.age_min) : '',
      row.age_max != null ? String(row.age_max) : '',
      row.range_low != null ? String(row.range_low) : '',
      row.range_high != null ? String(row.range_high) : '',
      row.source,
      row.range_type,
    ]
    lines.push(values.map(escapeCsv).join(','))
  }

  // Prefix with UTF-8 BOM
  return { data: '\uFEFF' + lines.join('\n'), error: null }
}
