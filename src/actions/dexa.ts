'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/session'
import { userErrorMessage } from '@/lib/supabase/errors'
import type { DexaScan, DexaRegion, BodyGoal, BodyMetricKey, Sex } from '@/lib/database.types'
import type { DexaScanExtract, DexaRegionExtract } from '@/lib/validations/dexa-import'

/** The signed-in user's sex (for sex-specific reference bands), or null. */
export async function getProfileSex(): Promise<Sex | null> {
  const { supabase, user } = await getSessionUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('sex')
    .eq('id', user.id)
    .maybeSingle()
  return ((data as { sex?: Sex } | null)?.sex as Sex | null) ?? null
}

export interface DexaScanWithRegions {
  scan: DexaScan
  regions: DexaRegion[]
}

/** All of the signed-in user's scans, newest first (RLS scopes to owner). */
export async function getScans(): Promise<DexaScan[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dexa_scans')
    .select('*')
    .order('scan_date', { ascending: false })
  // Throw rather than return [] so the page shows an error instead of
  // "no data" (dashboard error.tsx).
  if (error) {
    console.error('getScans failed:', error.message)
    throw new Error(`Could not load your data (getScans): ${error.message}`)
  }
  return (data ?? []) as DexaScan[]
}

/** One scan + its regions, or null if not found / not owned. */
export async function getScan(id: string): Promise<DexaScanWithRegions | null> {
  const supabase = await createClient()
  const { data: scan } = await supabase
    .from('dexa_scans')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!scan) return null
  const { data: regions } = await supabase
    .from('dexa_regions')
    .select('*')
    .eq('scan_id', id)
  return { scan: scan as DexaScan, regions: (regions ?? []) as DexaRegion[] }
}

/** Update a scan's fields and (optionally) replace its regions. */
export async function updateScan(
  id: string,
  patch: { scan: Partial<DexaScanExtract>; regions?: DexaRegionExtract[] }
): Promise<{ error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'Not authenticated' }

  const { error } = await supabase
    .from('dexa_scans')
    .update({ ...patch.scan, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    return {
      error: userErrorMessage('updateScan', error, 'Could not save the scan. Please try again.'),
    }
  }

  if (patch.regions) {
    // Snapshot existing regions so we can restore them if the replacement
    // insert fails — otherwise a failed insert would leave the scan stripped
    // of all regional data (saveDexaScan rolls back the same way).
    const { data: existing, error: snapshotErr } = await supabase
      .from('dexa_regions')
      .select('*')
      .eq('scan_id', id)
    if (snapshotErr) return { error: snapshotErr.message }
    const snapshot = (existing ?? []) as DexaRegion[]

    const { error: deleteErr } = await supabase
      .from('dexa_regions')
      .delete()
      .eq('scan_id', id)
    if (deleteErr) return { error: deleteErr.message }

    if (patch.regions.length > 0) {
      const rows = patch.regions.map((r) => ({ scan_id: id, ...r }))
      const { error: regionErr } = await supabase.from('dexa_regions').insert(rows)
      if (regionErr) {
        // Restore the snapshot so the scan keeps its original breakdown.
        if (snapshot.length > 0) {
          // Drop the primary key so Postgres assigns fresh ones on restore.
          const restore = snapshot.map(({ id: _id, ...rest }) => rest)
          const { error: restoreErr } = await supabase.from('dexa_regions').insert(restore)
          if (restoreErr) {
            console.error('updateScan: region restore failed', { scanId: id, error: restoreErr.message })
            return {
              error: `Saving the regions failed (${regionErr.message}) and the previous regions could not be restored. Please re-enter them.`,
            }
          }
        }
        return { error: regionErr.message }
      }
    }
  }

  revalidatePath('/body')
  revalidatePath(`/body/${id}`)
  return { error: null }
}

export async function deleteScan(id: string): Promise<{ error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'Not authenticated' }

  const { error } = await supabase.from('dexa_scans').delete().eq('id', id)
  if (error) {
    return {
      error: userErrorMessage('deleteScan', error, 'Could not delete the scan. Please try again.'),
    }
  }
  revalidatePath('/body')
  return { error: null }
}

export async function getGoals(): Promise<BodyGoal[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('body_goals').select('*')
  // Throw rather than return [] so the page shows an error instead of
  // "no data" (dashboard error.tsx).
  if (error) {
    console.error('getGoals failed:', error.message)
    throw new Error(`Could not load your data (getGoals): ${error.message}`)
  }
  return (data ?? []) as BodyGoal[]
}

/** Upsert the user's target for one metric (one row per user+metric). */
export async function saveGoal(
  metric: BodyMetricKey,
  targetValue: number
): Promise<{ error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'Not authenticated' }

  const { error } = await supabase
    .from('body_goals')
    .upsert(
      { user_id: user.id, metric, target_value: targetValue, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,metric' }
    )
  if (error) {
    return {
      error: userErrorMessage('saveGoal', error, 'Could not save the goal. Please try again.'),
    }
  }
  revalidatePath('/body')
  return { error: null }
}
