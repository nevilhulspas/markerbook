'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchAllPages } from '@/lib/supabase/fetch-all-pages'
import { getSessionUser } from '@/lib/supabase/session'
import {
  collectLabOptionCandidates,
  countMarkersPerLabTest,
  rankLabOptions,
  toLabTestsForBiomarker,
  type LabOptionForBiomarker,
  type LabOptionRow,
  type LabTestForBiomarker,
  type LabTestForBiomarkerRow,
} from '@/lib/next-to-test/lab-options'

// ---------- SOURCE PICKER OPTIONS ----------

/**
 * For each biomarker_id given, list every approved lab_test that covers it,
 * grouped by lab and ranked within each lab so the most precise (dedicated)
 * test appears before bundles/panels. Powers the inline source picker.
 *
 * The picker UI then visually separates the dedicated single-marker tests
 * from the multi-marker bundles inside each lab section — see
 * markerCount + the `isBundle` it derives.
 *
 * Sort within a lab:
 *   1. The user's currently-pinned lab_test wins (so the row's actual
 *      selection always shows up first / marked as "current").
 *   2. Fewest biomarker mappings (single > panel — most precise).
 *   3. Cheapest cost (null treated as +Infinity).
 *   4. Shortest name.
 *   5. Alphabetical id (deterministic).
 *
 * Labs are alphabetical so the picker order is stable across reloads.
 *
 * Returns a plain object (Record) — Maps don't survive the server-action
 * wire transit. A biomarker no lab in the catalogue offers yet has no key in
 * the result (not an empty array); the picker degrades to "Any lab" only.
 */
export async function getLabOptionsForBiomarkers(
  biomarkerIds: string[],
  preferredLabTestIds: string[] = []
): Promise<Record<string, LabOptionForBiomarker[]>> {
  const unique = Array.from(new Set(biomarkerIds.filter(Boolean)))
  if (unique.length === 0) return {}
  const supabase = await createClient()

  // Main query: every (biomarker_id, lab_test_id, lab) candidate with cost.
  // RLS doesn't restrict the public catalogue so user-context client is fine.
  // Paged: a long list times several labs passes the 1000-row cap.
  const main = await fetchAllPages<LabOptionRow>((from, to) =>
    supabase
      .from('lab_test_biomarkers')
      .select(
        'biomarker_id, lab_tests!inner(id, name, cost, status, labs!inner(id, name, status))'
      )
      .in('biomarker_id', unique)
      .order('biomarker_id')
      .order('lab_test_id')
      .range(from, to)
  )
  // The picker degrades to "Any lab" on {}; log so a failure is not silent.
  if ('error' in main) {
    console.error('getLabOptionsForBiomarkers: lab options read failed:', main.error)
    return {}
  }
  const { candidates, labTestIds } = collectLabOptionCandidates(main.rows)

  // Marker counts per lab_test_id — needed for "most precise" ranking
  // (single-marker tests beat panels). Covers only the lab_tests we actually
  // saw above, and is paged: one page would cut big panels' counts short.
  let markerCount = new Map<string, number>()
  if (labTestIds.size > 0) {
    const counts = await fetchAllPages<{ lab_test_id: string }>((from, to) =>
      supabase
        .from('lab_test_biomarkers')
        .select('lab_test_id')
        .in('lab_test_id', Array.from(labTestIds))
        .order('lab_test_id')
        .order('biomarker_id')
        .range(from, to)
    )
    // Without counts the options still list; uncounted tests rank last.
    if ('error' in counts) {
      console.error('getLabOptionsForBiomarkers: marker counts read failed:', counts.error)
    } else {
      markerCount = countMarkersPerLabTest(counts.rows)
    }
  }

  return rankLabOptions(candidates, markerCount, preferredLabTestIds)
}

// ---------- MEMBERSHIP HELPERS ----------

/** Mapping of biomarkerId -> the user's list ids that include it. Plain
 * object so the value is JSON-safe for server-action wire transit. */
export async function getBiomarkerListMembership(
  biomarkerIds: string[]
): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {}
  if (biomarkerIds.length === 0) return out
  const { supabase, user } = await getSessionUser()
  if (!user) return out
  const { data } = await supabase
    .from('next_to_test')
    .select('biomarker_id, list_id')
    .eq('user_id', user.id)
    .in('biomarker_id', biomarkerIds)
  for (const row of (data ?? []) as Array<{
    biomarker_id: string
    list_id: string
  }>) {
    const cur = out[row.biomarker_id] ?? []
    cur.push(row.list_id)
    out[row.biomarker_id] = cur
  }
  return out
}

/** Mapping of labTestId -> the user's list ids that include it. Plain
 * object so the value is JSON-safe for server-action wire transit. */
export async function getLabTestListMembership(
  labTestIds: string[]
): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {}
  if (labTestIds.length === 0) return out
  const { supabase, user } = await getSessionUser()
  if (!user) return out
  const { data } = await supabase
    .from('next_to_test')
    .select('lab_test_id, list_id')
    .eq('user_id', user.id)
    .in('lab_test_id', labTestIds)
  for (const row of (data ?? []) as Array<{
    lab_test_id: string
    list_id: string
  }>) {
    const cur = out[row.lab_test_id] ?? []
    cur.push(row.list_id)
    out[row.lab_test_id] = cur
  }
  return out
}

// ---------- LAB CHOICE HELPERS ----------

/**
 * For a given biomarker, return every approved lab_test (with its lab name +
 * price) that maps to it via the lab_test_biomarkers join table. Used by the
 * "Add to next-to-test" dialog's step 2 to offer the user a lab choice on top
 * of the lab-agnostic biomarker option.
 *
 * Auth-gated, but the data is the same for every user — RLS on the join is
 * USING (true) and lab_tests/labs are public-to-authenticated for approved
 * rows, so we read with the user-context client.
 */
export async function getLabTestsForBiomarker(
  biomarkerId: string
): Promise<LabTestForBiomarker[]> {
  const { supabase, user } = await getSessionUser()
  if (!user) return []

  // Join chain: lab_test_biomarkers -> lab_tests -> labs
  const { data } = await supabase
    .from('lab_test_biomarkers')
    .select(
      'lab_test_id, lab_tests!inner(id, name, cost, currency, status, labs!inner(id, name, status))'
    )
    .eq('biomarker_id', biomarkerId)

  return toLabTestsForBiomarker((data ?? []) as LabTestForBiomarkerRow[])
}

export interface BiomarkerOption {
  id: string
  name: string
}

/**
 * Active biomarker catalogue (id + name) for the "Add to next-to-test" dialog's
 * blood picker. Server action rather than a client `.from('biomarkers')` query
 * because auth cookies are now httpOnly — the browser Supabase client can no
 * longer authenticate, so its reads would be RLS-blocked (see
 * lib/supabase/cookie-options.ts).
 */
export async function getBiomarkersForPicker(): Promise<BiomarkerOption[]> {
  const { supabase, user } = await getSessionUser()
  if (!user) return []

  const { data } = await supabase
    .from('biomarkers')
    .select('id, name')
    .is('archived_at', null)
    .order('name')
  return (data ?? []) as BiomarkerOption[]
}
