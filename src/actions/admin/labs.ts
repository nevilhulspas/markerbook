'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/require-admin'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isUniqueViolation } from '@/lib/supabase/errors'
import type { Lab, LabTest, LabStatus } from '@/lib/database.types'

function revalidateLabs(): void {
  revalidatePath('/admin/labs')
  revalidatePath('/labs')
}

export async function adminListLabs(): Promise<Lab[]> {
  await requireAdmin()
  const { data } = await supabaseAdmin
    .from('labs')
    .select('*')
    .order('created_at', { ascending: false })
  return (data ?? []) as Lab[]
}

export interface AdminLabTestWithBiomarkers extends LabTest {
  biomarkers: { id: string; name: string; short_name: string | null }[]
}

export async function adminListLabTests(
  labId: string
): Promise<AdminLabTestWithBiomarkers[]> {
  await requireAdmin()
  // Admins see all statuses (no status filter).
  const { data, error } = await supabaseAdmin
    .from('lab_tests')
    .select('*, lab_test_biomarkers(biomarkers(id, name, short_name))')
    .eq('lab_id', labId)
    .order('name')
  if (error) {
    console.error('adminListLabTests query failed:', error.message)
    return []
  }

  return (data ?? []).map((t) => ({
    ...t,
    biomarkers: (t.lab_test_biomarkers ?? [])
      .map((j) => j.biomarkers)
      .filter((b): b is NonNullable<typeof b> => Boolean(b)),
  }))
}

export async function adminCreateLab(input: {
  name: string
  country?: string | null
  city?: string | null
  website?: string | null
  description?: string | null
  status?: LabStatus
}): Promise<{ data: Lab | null; error: string | null }> {
  const admin = await requireAdmin()
  const { data, error } = await supabaseAdmin
    .from('labs')
    .insert({
      name: input.name,
      country: input.country ?? null,
      city: input.city ?? null,
      website: input.website ?? null,
      description: input.description ?? null,
      status: input.status ?? 'approved',
      submitted_by: admin.id,
    })
    .select()
    .single()
  if (error || !data) {
    if (isUniqueViolation(error)) {
      return { data: null, error: 'A lab with that name or website already exists.' }
    }
    return { data: null, error: error?.message ?? null }
  }
  revalidateLabs()
  return { data: data as Lab, error: null }
}

export async function adminUpdateLab(
  id: string,
  patch: Partial<Pick<Lab, 'name' | 'country' | 'city' | 'website' | 'description'>>
): Promise<{ error: string | null }> {
  await requireAdmin()
  const { error } = await supabaseAdmin
    .from('labs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    if (isUniqueViolation(error)) {
      return { error: 'Another lab already uses that name or website.' }
    }
    return { error: error.message }
  }
  revalidateLabs()
  return { error: null }
}

export async function adminSetLabStatus(
  id: string,
  status: LabStatus,
  notes?: string
): Promise<{ error: string | null }> {
  const admin = await requireAdmin()
  const { error } = await supabaseAdmin
    .from('labs')
    .update({
      status,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      review_notes: notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidateLabs()
  return { error: null }
}

export async function adminDeleteLab(id: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const { error } = await supabaseAdmin.from('labs').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidateLabs()
  return { error: null }
}

export async function adminSaveLabTest(input: {
  id?: string
  lab_id: string
  name: string
  method?: string | null
  cost?: number | null
  currency?: string | null
  turnaround_days?: number | null
  sample_type?: string | null
  notes?: string | null
  status?: LabStatus
  biomarkerIds: string[]
}): Promise<{ data: LabTest | null; error: string | null }> {
  const admin = await requireAdmin()
  const row = {
    lab_id: input.lab_id,
    name: input.name,
    method: input.method ?? null,
    cost: input.cost ?? null,
    currency: input.currency ?? null,
    turnaround_days: input.turnaround_days ?? null,
    sample_type: input.sample_type ?? null,
    notes: input.notes ?? null,
    status: input.status ?? 'approved',
    submitted_by: admin.id,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = input.id
    ? await supabaseAdmin.from('lab_tests').update(row).eq('id', input.id).select().single()
    : await supabaseAdmin.from('lab_tests').insert(row).select().single()
  if (error || !data) return { data: null, error: error?.message ?? 'Save failed' }

  const testId = (data as LabTest).id
  // Replace biomarker links
  await supabaseAdmin.from('lab_test_biomarkers').delete().eq('lab_test_id', testId)
  if (input.biomarkerIds.length > 0) {
    const { error: linkError } = await supabaseAdmin.from('lab_test_biomarkers').insert(
      input.biomarkerIds.map((biomarker_id) => ({ lab_test_id: testId, biomarker_id }))
    )
    // The links were just cleared; surface a failed re-insert instead of
    // silently leaving the test with no biomarker associations.
    if (linkError)
      return { data: null, error: `Saved test but failed to link biomarkers: ${linkError.message}` }
  }
  revalidateLabs()
  return { data: data as LabTest, error: null }
}

export async function adminDeleteLabTest(id: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const { error } = await supabaseAdmin.from('lab_tests').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidateLabs()
  return { error: null }
}
