'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  otherExtractionSchema,
  type OtherExtraction,
} from '@/lib/validations/other-import'
import type {
  OtherTest,
  OtherTestValue,
  OtherTestWithValues,
} from '@/lib/database.types'

/** All of the signed-in user's "other" tests, newest first (RLS scopes to owner). */
export async function getOtherTests(): Promise<OtherTest[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('other_tests')
    .select('*')
    .order('test_date', { ascending: false })
  // Throw rather than return [] so the page shows an error instead of
  // "no data" (dashboard error.tsx).
  if (error) {
    console.error('getOtherTests failed:', error.message)
    throw new Error(`Could not load your data (getOtherTests): ${error.message}`)
  }
  return (data ?? []) as OtherTest[]
}

/** One "other" test with its readings, or null if not found / not owned. */
export async function getOtherTest(id: string): Promise<OtherTestWithValues | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('other_tests')
    .select('*, values:other_test_values(*)')
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  const test = data as OtherTest & { values: OtherTestValue[] }
  const values = [...(test.values ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  return { ...test, values }
}

/**
 * Update an "other" test's editable fields and replace its readings.
 *
 * The readings are swapped wholesale (delete-then-insert) rather than diffed —
 * the set is small and order is significant. The old rows are snapshotted first
 * so a failed re-insert restores them instead of silently wiping the readings
 * (mirrors the parent rollback in saveOtherTest).
 */
export async function updateOtherTest(
  id: string,
  extraction: OtherExtraction
): Promise<{ error: string | null }> {
  const parsed = otherExtractionSchema.safeParse(extraction)
  if (!parsed.success) return { error: 'Invalid test data' }

  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'Not authenticated' }

  const t = parsed.data.test
  const { error: updateError } = await supabase
    .from('other_tests')
    .update({
      test_name: t.test_name,
      test_date: t.test_date,
      provider: t.provider,
      outcome: t.outcome,
      result_summary: t.result_summary,
      notes: t.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (updateError) return { error: updateError.message }

  // Snapshot existing readings so a failed re-insert can roll back. Abort before
  // the delete if the snapshot can't be read — otherwise a later insert failure
  // would have nothing to restore from and silently drop the readings.
  const { data: previousRaw, error: snapshotError } = await supabase
    .from('other_test_values')
    .select('label, value, unit, flag, sort_order')
    .eq('test_id', id)
  if (snapshotError) return { error: snapshotError.message }
  const previous = (previousRaw ?? []) as Pick<
    OtherTestValue,
    'label' | 'value' | 'unit' | 'flag' | 'sort_order'
  >[]

  const { error: deleteError } = await supabase
    .from('other_test_values')
    .delete()
    .eq('test_id', id)
  if (deleteError) return { error: deleteError.message }

  const rows = parsed.data.values.map((v, i) => ({
    test_id: id,
    label: v.label,
    value: v.value,
    unit: v.unit,
    flag: v.flag,
    sort_order: i,
  }))
  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('other_test_values').insert(rows)
    if (insertError) {
      // Restore the snapshot so an edit never drops the existing readings.
      if (previous.length > 0) {
        const { error: restoreError } = await supabase
          .from('other_test_values')
          .insert(previous.map((p) => ({ ...p, test_id: id })))
        if (restoreError) {
          // Both the new insert and the restore failed — the prior readings are
          // gone. Surface that explicitly so the user knows recovery is needed
          // rather than seeing a generic save error.
          console.error('Other-test readings restore failed:', restoreError.message)
          return {
            error:
              'Saving the readings failed and the previous readings could not be restored. Please re-enter them or contact support.',
          }
        }
      }
      return { error: insertError.message }
    }
  }

  revalidatePath('/other')
  revalidatePath(`/other/${id}`)
  return { error: null }
}

export async function deleteOtherTest(id: string): Promise<{ error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'Not authenticated' }

  // Read the stored source path (RLS-scoped) before deleting so we can clean up
  // the bucket afterwards — the child readings cascade via the FK.
  const { data: row } = await supabase
    .from('other_tests')
    .select('pdf_storage_path')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('other_tests').delete().eq('id', id)
  if (error) return { error: error.message }

  // Best-effort: remove the orphaned source file so deleted tests don't leave
  // unreachable blobs in storage. Non-fatal — the row is already gone.
  const path = (row as { pdf_storage_path: string | null } | null)?.pdf_storage_path
  if (path && path.startsWith(`${user.id}/`)) {
    const { error: rmError } = await supabaseAdmin.storage.from('lab-pdfs').remove([path])
    if (rmError) console.error('Other-test source cleanup failed:', rmError.message)
  }

  revalidatePath('/other')
  return { error: null }
}

/** A short-lived signed URL for the stored source PDF/image, or null. */
export async function getOtherTestSourceUrl(
  storagePath: string
): Promise<{ url: string | null; error?: string }> {
  const { user, authError } = await getSessionUser()
  if (!user) return { url: null, error: authError ?? 'Not authenticated' }

  // Paths are namespaced by user id — never sign a path outside the caller's space.
  if (!storagePath.startsWith(`${user.id}/`)) return { url: null, error: 'Unauthorized' }

  const { data, error } = await supabaseAdmin.storage
    .from('lab-pdfs')
    .createSignedUrl(storagePath, 3600) // 1 hour
  if (error || !data?.signedUrl) {
    return { url: null, error: error?.message ?? 'Failed to generate URL' }
  }
  return { url: data.signedUrl }
}

/** Persist an AI interpretation onto the test row (Interpret button target). */
export async function saveOtherInterpretation(
  id: string,
  content: string
): Promise<{ error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'Not authenticated' }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('other_tests')
    .update({ interpretation: content, interpreted_at: now, updated_at: now })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/other/${id}`)
  return { error: null }
}
