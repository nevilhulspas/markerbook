'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import type { MarkerSuggestion } from '@/lib/database.types'

export async function getSuggestions(params: {
  status?: 'pending' | 'approved' | 'rejected'
}): Promise<{ data: MarkerSuggestion[] | null; error: string | null }> {
  await requireAdmin()

  let query = supabaseAdmin
    .from('marker_suggestions')
    .select('*')
    .order('created_at', { ascending: false })

  if (params.status) {
    query = query.eq('status', params.status)
  }

  const { data, error } = await query

  if (!data || error) {
    return { data: null, error: error?.message ?? null }
  }

  // Batch-fetch user emails from auth.users (separate schema, can't join via PostgREST).
  // listUsers defaults to perPage=50 — page through to avoid truncating the email map.
  const userIds = [...new Set(data.map((s: { user_id: string }) => s.user_id))]
  const emailMap = new Map<string, string | undefined>()
  let page = 1
  const perPage = 1000
  while (true) {
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (authError || !authData?.users) break
    for (const u of authData.users) {
      if (userIds.includes(u.id)) emailMap.set(u.id, u.email)
    }
    if (authData.users.length < perPage) break
    page++
  }

  const suggestions = data.map((row: Record<string, unknown>) => ({
    ...row,
    user_email: emailMap.get(row.user_id as string) ?? null,
  })) as MarkerSuggestion[]

  return { data: suggestions, error: null }
}

export async function rejectSuggestion(params: {
  suggestionId: string
  reviewNotes: string
}): Promise<{ success: true } | { success: false; error: string }> {
  const admin = await requireAdmin()

  const { error } = await supabaseAdmin
    .from('marker_suggestions')
    .update({
      status: 'rejected',
      reviewed_by: admin.id,
      review_notes: params.reviewNotes,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', params.suggestionId)
    .eq('status', 'pending')

  if (error) return { success: false, error: error.message }

  await writeAuditLog({
    userId: admin.id,
    action: 'reject',
    entityType: 'marker_suggestion',
    entityId: params.suggestionId,
    changes: { review_notes: params.reviewNotes },
  })

  revalidatePath('/admin/suggestions')
  return { success: true }
}

export async function approveSuggestion(params: {
  suggestionId: string
  reviewNotes?: string
  biomarkerData: { name: string; category: string; unit: string }
}): Promise<
  { success: true; biomarkerId: string } | { success: false; error: string }
> {
  const admin = await requireAdmin()

  const { data: biomarker, error: createError } = await supabaseAdmin
    .from('biomarkers')
    .insert({
      name: params.biomarkerData.name,
      category: params.biomarkerData.category,
      unit: params.biomarkerData.unit,
    })
    .select('id')
    .single()

  if (createError) return { success: false, error: createError.message }

  const { error: updateError } = await supabaseAdmin
    .from('marker_suggestions')
    .update({
      status: 'approved',
      reviewed_by: admin.id,
      review_notes: params.reviewNotes ?? null,
      reviewed_at: new Date().toISOString(),
      created_biomarker_id: biomarker.id,
    })
    .eq('id', params.suggestionId)
    .eq('status', 'pending')

  if (updateError) return { success: false, error: updateError.message }

  await writeAuditLog({
    userId: admin.id,
    action: 'approve',
    entityType: 'marker_suggestion',
    entityId: params.suggestionId,
    changes: { created_biomarker_id: biomarker.id, ...params.biomarkerData },
  })

  revalidatePath('/admin/suggestions')
  return { success: true, biomarkerId: biomarker.id }
}
