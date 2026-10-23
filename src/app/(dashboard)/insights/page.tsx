import type { Metadata } from 'next'

import { deriveFrequency } from '@/lib/supplements/intake'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type { Biomarker, ChatThread, ReferenceRange, SnpVariant } from '@/lib/database.types'
import type { BiomarkerWithRelations } from '@/actions/blood-tests'
import { getSupplements } from '@/actions/supplements'
import { getHealthRelevantSnps } from '@/actions/genetics'
import { getDutchTests, getDutchTestDetail } from '@/actions/dutch-tests'
import {
  getMicrobiomeTests,
  getMicrobiomeTestDetail,
} from '@/actions/microbiome-tests'
import { getMedicalConditions } from '@/actions/medical-conditions'
import { getOtherTests, getOtherTest } from '@/actions/other-tests'
import { getRmrTests, getProfileActivityLevel } from '@/actions/rmr'
import { tdee, fatLossRange, leanGainRange } from '@/lib/rmr/tdee'
import type {
  DutchContext,
  DutchMarkerSummary,
  DutchComputedSummary,
  MicrobiomeTestContext,
  OtherTestContext,
  RmrContext,
} from '@/lib/insights/insights-chat-prompt'
import type { PanelSystemLookup } from '@/lib/grid/grid-types'
import {
  buildGridData,
  type GridEnrichment,
  type TestWithResults,
} from '@/lib/grid/build-grid-data'
import { getRangeStatusFromRanges } from '@/lib/grid/reference-range'
import { markerUnitsForRow, resolveResultRange } from '@/lib/units/result-range'
import { convertUnit } from '@/lib/units/convert'
import { computeHealthScores } from '@/lib/insights/health-scores'
import type {
  MarkerHistoryEntry,
  ProfileContext,
  SupplementContext,
} from '@/lib/interpretation/types'
import { throwIfAuthOutage } from '@/lib/supabase/auth-outage'
import { InsightsClient } from '@/components/insights/insights-client'
import { getRequestUser } from '@/lib/supabase/request-user'
import { isAiConfigured } from '@/lib/ai/config'

export const metadata: Metadata = {
  title: 'Chat | Markerbook',
}

function computeAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  return age
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>
}) {
  const { thread: initialThreadId } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await getRequestUser()
  throwIfAuthOutage(user, authError)
  if (!user) redirect('/login')

  const isAdmin = user.app_metadata?.role === 'admin'

  // Fetch threads, profile, tests, biomarkers, supplements in parallel
  const [
    { data: threads },
    { data: profile },
    { data: tests },
    { data: enrichedBiomarkers },
    supplementsResult,
    geneticsResult,
  ] = await Promise.all([
    supabase
      .from('chat_threads')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('blood_tests')
      .select(
        `id, name, test_date, sample_type,
        test_results (id, value, unit, biomarkers ( * ))`
      )
      .order('test_date', { ascending: true }),
    supabase
      .from('biomarkers')
      .select('*, biomarker_units(*), reference_ranges(*), panels(*, systems(*))'),
    getSupplements(),
    getHealthRelevantSnps(),
  ])

  // Build enrichment map
  const enrichmentMap: GridEnrichment = new Map()
  const allBiomarkersMap = new Map<string, Biomarker>()
  const panelLookup: PanelSystemLookup = { panels: new Map() }

  if (enrichedBiomarkers) {
    // Narrowing cast: the hand-written Biomarker/ReferenceRange types are stricter than the schema.
    for (const bm of enrichedBiomarkers as BiomarkerWithRelations[]) {
      enrichmentMap.set(bm.id, {
        units: bm.biomarker_units ?? [],
        ranges: bm.reference_ranges ?? [],
      })
      allBiomarkersMap.set(bm.id, bm)
      if (bm.panels && bm.panel_id && !panelLookup.panels.has(bm.panel_id)) {
        panelLookup.panels.set(bm.panel_id, {
          ...bm.panels,
          system: bm.panels.systems,
        })
      }
    }
  }

  // Narrowing cast: the embedded biomarkers rows are stricter in the hand-written Biomarker type.
  const gridData = buildGridData(
    (tests ?? []) as TestWithResults[],
    profile?.sex,
    enrichmentMap,
    allBiomarkersMap,
    panelLookup.panels.size > 0 ? panelLookup : undefined
  )

  const sex =
    profile?.sex === 'male' || profile?.sex === 'female' ? profile.sex : null
  const chronologicalAge =
    profile?.date_of_birth ? computeAge(profile.date_of_birth) : null

  const latestTest =
    gridData.testDates.length > 0
      ? gridData.testDates[gridData.testDates.length - 1]
      : null

  // Health scores
  const healthScores = latestTest
    ? computeHealthScores(
        gridData.rows,
        latestTest.id,
        sex,
        chronologicalAge,
        latestTest.date,
        latestTest.name
      )
    : {
        overall: 0, categories: [], totalMarkers: 0, totalNormal: 0,
        totalBorderline: 0, totalOutOfRange: 0, totalUnknown: 0,
        latestTestDate: null, latestTestName: null,
      }

  // Build marker history
  const markerHistory: MarkerHistoryEntry[] = []
  for (const row of gridData.rows) {
    const history: MarkerHistoryEntry['history'] = []
    for (const test of gridData.testDates) {
      const cell = row.values[test.id]
      if (!cell) continue
      // Status is compared in a range unit the value converts to; the value
      // goes to the AI in the catalogue unit when possible, so one marker's
      // history reads in one unit.
      const marker = markerUnitsForRow(row)
      const status = resolveResultRange(
        cell.value, cell.unit, row.biomarker, row.referenceRanges ?? [], marker, sex, chronologicalAge
      ).status
      const inCatalogue = convertUnit(cell.value, cell.unit, marker.catalogueUnit, marker)
      history.push({
        testDate: test.date,
        testName: test.name,
        value: inCatalogue ?? cell.value,
        unit: inCatalogue !== null ? marker.catalogueUnit : cell.unit,
        status,
      })
    }
    if (history.length > 0) {
      markerHistory.push({
        name: row.biomarker.name,
        shortName: row.biomarker.short_name,
        category: row.category,
        history,
      })
    }
  }

  // Supplements context
  const supplements: SupplementContext[] = (supplementsResult.data ?? []).map(
    (s) => ({
      name: s.name,
      dose: s.dose,
      frequency: deriveFrequency(s.intakes, s.frequency),
      startDate: s.start_date,
      endDate: s.end_date,
      intakes: s.intakes,
    })
  )

  // The remaining chat-context reads are independent of each other, so fetch
  // them together (they used to run one after another).
  const [
    // Medical-history conditions list — RLS scopes to the current user.
    medicalConditions,
    dutchTestsResult,
    microbiomeListResult,
    // Chat context only: if this list fails to load, carry on without it
    // rather than make the whole insights page unavailable.
    otherTestList,
    // Chat context only, as above: degrade to "no RMR" on a read failure.
    rmrTests,
    activityLevel,
  ] = await Promise.all([
    getMedicalConditions(),
    getDutchTests(),
    getMicrobiomeTests(),
    getOtherTests().catch((err: unknown) => {
      console.error('[insights] other tests unavailable for chat context', err)
      return []
    }),
    getRmrTests().catch((err: unknown) => {
      console.error('[insights] RMR tests unavailable for chat context', err)
      return []
    }),
    getProfileActivityLevel(),
  ])

  // Profile context (AUT-854: now includes the optional medical-history fields
  // + conditions list — all flow into formatProfile() and the chat system
  // prompt's `## User Profile` block).
  const profileContext: ProfileContext = {
    dateOfBirth: profile?.date_of_birth ?? null,
    sex: profile?.sex ?? null,
    heightCm: profile?.height_cm ?? null,
    weightKg: profile?.weight_kg ?? null,
    activityLevel: profile?.activity_level ?? null,
    extraNotes: profile?.extra_notes ?? null,
    bornViaCsection: profile?.born_via_csection ?? null,
    breastfedAsInfant: profile?.breastfed_as_infant ?? null,
    smokingStatus: profile?.smoking_status ?? null,
    alcoholDrinksPerWeek: profile?.alcohol_drinks_per_week ?? null,
    pregnancyStatus: profile?.pregnancy_status ?? null,
    knownAllergies: profile?.known_allergies ?? null,
    familyHistory: profile?.family_history ?? null,
    dietPattern: profile?.diet_pattern ?? null,
    medicalConditions: medicalConditions.map((c) => ({
      name: c.condition_name,
      startDate: c.start_date,
      endDate: c.end_date,
      notes: c.notes,
    })),
  }

  const geneticSnps = (geneticsResult.data ?? []) as SnpVariant[]

  // Fetch latest DUTCH test for AI context (INT-01)
  let dutchContext: DutchContext | null = null
  const latestDutchTest = dutchTestsResult.data?.[0]

  if (latestDutchTest) {
    const dutchDetail = await getDutchTestDetail(latestDutchTest.id)
    if (dutchDetail.data) {
      const detail = dutchDetail.data
      // Fetch reference ranges for DUTCH biomarkers
      const dutchBiomarkerIds = [...new Set(detail.dutch_test_results.map((r) => r.biomarker_id))]
      const { data: dutchRefRanges } = dutchBiomarkerIds.length > 0
        ? await supabase.from('dutch_reference_ranges').select('*').in('biomarker_id', dutchBiomarkerIds)
        : { data: [] as ReferenceRange[] }

      const dutchRangesByBiomarker = new Map<string, ReferenceRange[]>()
      for (const range of dutchRefRanges ?? []) {
        const list = dutchRangesByBiomarker.get(range.biomarker_id) ?? []
        list.push(range as ReferenceRange)
        dutchRangesByBiomarker.set(range.biomarker_id, list)
      }

      const dutchPhase = detail.menstrual_phase === 'male' ? null : detail.menstrual_phase

      const markers: DutchMarkerSummary[] = detail.dutch_test_results.map((r) => ({
        name: r.biomarkers.name,
        shortName: r.biomarkers.short_name,
        value: r.value,
        unit: r.unit,
        category: r.biomarkers.category,
        timepoint: r.timepoint,
        status: getRangeStatusFromRanges(
          r.value,
          dutchRangesByBiomarker.get(r.biomarker_id) ?? [],
          r.unit,
          sex,
          null,
          dutchPhase
        ),
      }))

      const computedValues: DutchComputedSummary[] = detail.dutch_computed_values.map((cv) => ({
        name: cv.name,
        value: cv.value,
        unit: cv.unit,
      }))

      dutchContext = {
        testDate: detail.test_date,
        menstrualPhase: detail.menstrual_phase,
        markers,
        computedValues,
      }
    }
  }

  // Fetch ALL microbiome tests (full results + scores) for AI context
  // Details in parallel (was one request after another); order is kept.
  const microbiomeTests: MicrobiomeTestContext[] = []
  const microbiomeDetails = await Promise.all(
    (microbiomeListResult.data ?? []).map((t) => getMicrobiomeTestDetail(t.id))
  )
  for (const detail of microbiomeDetails) {
    if (!detail.data) continue
    microbiomeTests.push({
      testDate: detail.data.test_date,
      name: detail.data.name,
      labName: detail.data.lab_name,
      results: detail.data.microbiome_results.map((r) => ({
        name: r.microbiome_taxa.name,
        rank: r.microbiome_taxa.rank,
        value: r.value,
        unit: r.unit,
        refLow: r.ref_low,
        refHigh: r.ref_high,
        status: r.status,
        rawLabel: r.raw_label,
      })),
      scores: detail.data.microbiome_scores.map((s) => ({
        name: s.name,
        value: s.value,
        unit: s.unit,
        status: s.status,
      })),
    })
  }

  // "Other tests" (SIBO, STI screens, sleep studies, intolerance panels…) into
  // the chat context so every new conversation sees their results/readings.
  // Details are fetched in parallel (getOtherTest already returns readings).
  const otherTestDetails = await Promise.all(otherTestList.map((t) => getOtherTest(t.id)))
  const otherTests: OtherTestContext[] = otherTestDetails
    .filter((d): d is NonNullable<typeof d> => d != null)
    .map((detail) => ({
      testDate: detail.test_date,
      name: detail.test_name,
      provider: detail.provider,
      outcome: detail.outcome,
      resultSummary: detail.result_summary,
      notes: detail.notes,
      readings: detail.values.map((v) => ({
        label: v.label,
        value: v.value,
        unit: v.unit,
        flag: v.flag,
      })),
      hasDocument: detail.pdf_storage_path != null,
    }))

  // RMR + derived TDEE/calorie targets for the chat context. Mirrors
  // dutchContext (loaded server-side here, passed through props → transport →
  // route). TDEE/ranges are derived only when the profile has an activity level.
  let rmrContext: RmrContext | null = null
  const latestRmr = rmrTests[0]
  if (latestRmr) {
    const tdeeKcal = activityLevel ? tdee(latestRmr.rmr_kcal, activityLevel) : null
    rmrContext = {
      testDate: latestRmr.test_date,
      rmrKcal: latestRmr.rmr_kcal,
      predictedRmrKcal: latestRmr.predicted_rmr_kcal,
      rer: latestRmr.rer,
      fuelCarbPct: latestRmr.fuel_carb_pct,
      fuelFatPct: latestRmr.fuel_fat_pct,
      tdee: tdeeKcal,
      fatLoss: tdeeKcal != null ? fatLossRange(tdeeKcal) : null,
      leanGain: tdeeKcal != null ? leanGainRange(tdeeKcal) : null,
      activityLevel,
    }
  }

  return (
    <InsightsClient
      threads={(threads ?? []) as ChatThread[]}
      markerHistory={markerHistory}
      profile={profileContext}
      supplements={supplements}
      healthScores={healthScores}
      geneticSnps={geneticSnps}
      dutchContext={dutchContext}
      microbiomeTests={microbiomeTests}
      otherTests={otherTests}
      rmrContext={rmrContext}
      isAdmin={isAdmin}
      aiEnabled={isAiConfigured()}
      initialThreadId={initialThreadId ?? null}
    />
  )
}
