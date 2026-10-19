'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  createAnnotationSchema,
  updateAnnotationSchema,
} from '@/lib/validations/annotation'
import type { Annotation } from '@/lib/database.types'
import type { TableUpdate } from '@/lib/supabase/database'

export async function getAnnotations(): Promise<
  { data: Annotation[]; error: null } | { data: null; error: string }
> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { data: null, error: authError ?? 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('annotations')
    .select('*')
    .order('date', { ascending: false })

  if (error) {
    return { data: null, error: error.message }
  }

  return { data: (data ?? []) as Annotation[], error: null }
}

export async function createAnnotation(
  values: unknown
): Promise<
  | { success: true; annotation: Annotation; error: null }
  | { success: false; annotation: null; error: string }
> {
  const parsed = createAnnotationSchema.safeParse(values)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    return {
      success: false,
      annotation: null,
      error: `Invalid annotation data: ${issues}`,
    }
  }

  const { user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, annotation: null, error: authError ?? 'Not authenticated' }
  }

  const { data, error } = await supabaseAdmin
    .from('annotations')
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      body: parsed.data.body ?? null,
      date: parsed.data.date,
      end_date: parsed.data.end_date ?? null,
    })
    .select('*')
    .single()

  if (error) {
    return { success: false, annotation: null, error: error.message }
  }

  revalidatePath('/grid')
  return { success: true, annotation: data as Annotation, error: null }
}

export async function updateAnnotation(
  id: string,
  values: unknown
): Promise<
  | { success: true; annotation: Annotation; error: null }
  | { success: false; annotation: null; error: string }
> {
  const parsed = updateAnnotationSchema.safeParse(values)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    return {
      success: false,
      annotation: null,
      error: `Invalid annotation data: ${issues}`,
    }
  }

  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, annotation: null, error: authError ?? 'Not authenticated' }
  }

  // Verify ownership via RLS read
  const { data: existing } = await supabase
    .from('annotations')
    .select('id')
    .eq('id', id)
    .single()

  if (!existing) {
    return { success: false, annotation: null, error: 'Annotation not found' }
  }

  const updateData: TableUpdate<'annotations'> = {
    updated_at: new Date().toISOString(),
  }
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title
  if (parsed.data.body !== undefined) updateData.body = parsed.data.body
  if (parsed.data.date !== undefined) updateData.date = parsed.data.date
  if (parsed.data.end_date !== undefined) updateData.end_date = parsed.data.end_date

  const { data, error } = await supabaseAdmin
    .from('annotations')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return { success: false, annotation: null, error: error.message }
  }

  revalidatePath('/grid')
  return { success: true, annotation: data as Annotation, error: null }
}

export async function deleteAnnotation(
  id: string
): Promise<{ success: true; error: null } | { success: false; error: string }> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, error: authError ?? 'Not authenticated' }
  }

  // Verify ownership via RLS read
  const { data: existing } = await supabase
    .from('annotations')
    .select('id')
    .eq('id', id)
    .single()

  if (!existing) {
    return { success: false, error: 'Annotation not found' }
  }

  const { error } = await supabaseAdmin
    .from('annotations')
    .delete()
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/grid')
  return { success: true, error: null }
}
