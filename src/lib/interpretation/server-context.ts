import 'server-only'

import type { TypedSupabaseClient } from '@/lib/supabase/database'
import type { Biomarker, BiomarkerUnit, ReferenceRange } from '@/lib/database.types'
import { markerUnitsFor } from '@/lib/units/result-range'
import { convertUnit } from '@/lib/units/convert'
import { toMarkerContext } from './marker-context'
import type { MarkerContext, ProfileContext } from './types'

/**
 * The AI context for /api/interpret and /api/chat, loaded from the caller's
 * OWN stored data. The routes used to build the prompt from whatever the
 * browser sent, which turned them into a free general-purpose model endpoint
 * (any text, any size, as a "marker list"). Every query here is scoped to
 * `userId`; a test or result of another user is simply not found.
 */

type Sex = 'male' | 'female' | null

export async function loadProfileContext(
  supabase: TypedSupabaseClient,
  userId: string
): Promise<{ profile: ProfileContext; sex: Sex }> {
  const { data } = await supabase
    .from('profiles')
    .select('date_of_birth, sex, height_cm, weight_kg, activity_level')
    .eq('id', userId)
    .maybeSingle()
  const sex = data?.sex === 'male' || data?.sex === 'female' ? data.sex : null
  return {
    // The same five fields the interpretation screens always sent.
    profile: {
      dateOfBirth: data?.date_of_birth ?? null,
      sex: data?.sex ?? null,
      heightCm: data?.height_cm ?? null,
      weightKg: data?.weight_kg ?? null,
      activityLevel: data?.activity_level ?? null,
    },
    sex,
  }
}

async function loadRangesAndUnits(supabase: TypedSupabaseClient, biomarkerIds: string[]) {
  const ranges = new Map<string, ReferenceRange[]>()
  const units = new Map<string, BiomarkerUnit[]>()
  if (biomarkerIds.length === 0) return { ranges, units }
  const [{ data: rangeRows }, { data: unitRows }] = await Promise.all([
    supabase.from('reference_ranges').select('*').in('biomarker_id', biomarkerIds),
    supabase.from('biomarker_units').select('*').in('biomarker_id', biomarkerIds),
  ])
  for (const r of (rangeRows ?? []) as ReferenceRange[]) {
    ranges.set(r.biomarker_id, [...(ranges.get(r.biomarker_id) ?? []), r])
  }
  for (const u of (unitRows ?? []) as BiomarkerUnit[]) {
    units.set(u.biomarker_id, [...(units.get(u.biomarker_id) ?? []), u])
  }
  return { ranges, units }
}

export interface TestContext {
  name: string
  testDate: string
  results: Array<{ id: string; biomarkerName: string; context: MarkerContext }>
}

/** A blood test of `userId` with every result as MarkerContext, or null. */
export async function loadTestContext(
  supabase: TypedSupabaseClient,
  userId: string,
  bloodTestId: string,
  sex: Sex
): Promise<TestContext | null> {
  const { data } = await supabase
    .from('blood_tests')
    .select('id, name, test_date, test_results(id, value, unit, biomarkers(*))')
    .eq('id', bloodTestId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return null
  const rows = (data.test_results ?? []) as unknown as Array<{
    id: string
    value: number
    unit: string
    biomarkers: Biomarker | null
  }>
  const withMarker = rows.filter(
    (r): r is typeof r & { biomarkers: Biomarker } => r.biomarkers !== null
  )
  const { ranges, units } = await loadRangesAndUnits(
    supabase,
    [...new Set(withMarker.map((r) => r.biomarkers.id))]
  )
  return {
    name: data.name,
    testDate: data.test_date,
    results: withMarker.map((r) => ({
      id: r.id,
      biomarkerName: r.biomarkers.name,
      context: toMarkerContext(r, ranges.get(r.biomarkers.id) ?? [], units.get(r.biomarkers.id), sex),
    })),
  }
}

export interface BiomarkerHistory {
  biomarkerName: string
  bloodTestId: string
  unit: string
  refRangeLow: number | null
  refRangeHigh: number | null
  values: Array<{ date: string; value: number; unit?: string; testName: string }>
}

/**
 * The full history of the marker behind `testResultId` (a result of `userId`),
 * in the unit of its latest result's range where the values convert.
 */
export async function loadBiomarkerHistory(
  supabase: TypedSupabaseClient,
  userId: string,
  testResultId: string,
  sex: Sex
): Promise<BiomarkerHistory | null> {
  const { data: anchor } = await supabase
    .from('test_results')
    .select('id, biomarker_id, blood_tests!inner(user_id)')
    .eq('id', testResultId)
    .eq('blood_tests.user_id', userId)
    .maybeSingle()
  if (!anchor) return null

  const [{ data: bm }, { data: rows }] = await Promise.all([
    supabase.from('biomarkers').select('*').eq('id', anchor.biomarker_id).maybeSingle(),
    supabase
      .from('test_results')
      .select('value, unit, blood_tests!inner(id, test_date, name, user_id)')
      .eq('biomarker_id', anchor.biomarker_id)
      .eq('blood_tests.user_id', userId),
  ])
  if (!bm) return null
  const biomarker = bm as Biomarker
  const history = ((rows ?? []) as unknown as Array<{
    value: number
    unit: string
    blood_tests: { id: string; test_date: string; name: string }
  }>).sort((a, b) => a.blood_tests.test_date.localeCompare(b.blood_tests.test_date))
  const latest = history[history.length - 1]
  if (!latest) return null

  const { ranges, units } = await loadRangesAndUnits(supabase, [biomarker.id])
  const latestCtx = toMarkerContext(
    { value: latest.value, unit: latest.unit, biomarkers: biomarker },
    ranges.get(biomarker.id) ?? [],
    units.get(biomarker.id),
    sex
  )
  const marker = markerUnitsFor(biomarker, units.get(biomarker.id))
  return {
    biomarkerName: biomarker.short_name ?? biomarker.name,
    bloodTestId: latest.blood_tests.id,
    unit: latestCtx.unit,
    refRangeLow: latestCtx.refRangeLow,
    refRangeHigh: latestCtx.refRangeHigh,
    values: history.map((r) => {
      const converted = convertUnit(r.value, r.unit, latestCtx.unit, marker)
      return converted === null
        ? { date: r.blood_tests.test_date, value: r.value, unit: r.unit, testName: r.blood_tests.name }
        : { date: r.blood_tests.test_date, value: converted, unit: latestCtx.unit, testName: r.blood_tests.name }
    }),
  }
}
