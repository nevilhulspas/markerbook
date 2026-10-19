'use client'

import { useCallback, useState } from 'react'

import type { Profile, ReferenceRange } from '@/lib/database.types'
import type { BloodTestWithResults } from '@/actions/blood-tests'
import {
  findReferenceRange,
  getRangeStatus,
  getRangeStatusFromRanges,
} from '@/lib/grid/reference-range'
import { normalizeUnit } from '@/lib/grid/unit-conversion'
import { hashProfile, hashMarkerContext } from '@/lib/interpretation/cache'
import type {
  InterpretationRequest,
  MarkerContext,
  ProfileContext,
} from '@/lib/interpretation/types'
import { useInterpretation } from '@/hooks/use-interpretation'
import { FullTestButton } from '@/components/interpretation/full-test-button'
import { InterpretationPanel } from '@/components/interpretation/interpretation-panel'
import { APP_LOCALE } from '@/lib/locale'

interface TestDetailClientProps {
  test: BloodTestWithResults
  profile: Profile | null
  /** Enriched reference_ranges per biomarker (unit-aware), as built by the
   *  server page — lets the full-test interpretation match the status the
   *  table shows instead of falling back to inline fields only. */
  rangesByBiomarker?: Map<string, ReferenceRange[]>
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString(APP_LOCALE, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function TestDetailClient({
  test,
  profile,
  rangesByBiomarker,
}: TestDetailClientProps) {
  const interpretation = useInterpretation()
  const [panelOpen, setPanelOpen] = useState(false)

  const handleFullTestInterpret = useCallback(() => {
    const rangeSex =
      profile?.sex === 'male' || profile?.sex === 'female'
        ? profile.sex
        : null
    const allResults: MarkerContext[] = test.test_results.map((r) => {
      // Mirror the server table: enriched unit-specific ranges win; inline
      // biomarker fields are only trusted when their unit matches the
      // result's stored unit.
      const ranges = rangesByBiomarker?.get(r.biomarkers.id) ?? []
      let refLow: number | null = null
      let refHigh: number | null = null
      let status: string
      if (ranges.length > 0) {
        const range = findReferenceRange(ranges, r.unit, rangeSex)
        refLow = range.low
        refHigh = range.high
        status = getRangeStatusFromRanges(r.value, ranges, r.unit, rangeSex)
      } else if (normalizeUnit(r.unit) === normalizeUnit(r.biomarkers.unit)) {
        refLow = r.biomarkers.ref_range_low
        refHigh = r.biomarkers.ref_range_high
        status = getRangeStatus(r.value, r.biomarkers, profile?.sex).toString()
      } else {
        status = 'unknown'
      }
      return {
        name: r.biomarkers.name,
        shortName: r.biomarkers.short_name,
        value: r.value,
        unit: r.unit,
        category: r.biomarkers.category,
        refRangeLow: refLow,
        refRangeHigh: refHigh,
        status,
      }
    })

    const profileContext: ProfileContext = {
      dateOfBirth: profile?.date_of_birth ?? null,
      sex: profile?.sex ?? null,
      heightCm: profile?.height_cm ?? null,
      weightKg: profile?.weight_kg ?? null,
      activityLevel: profile?.activity_level ?? null,
    }

    const request: InterpretationRequest = {
      type: 'full_test',
      userId: profile?.id ?? '',
      bloodTestId: test.id,
      markerName: test.name,
      allTestResults: allResults,
      profile: profileContext,
    }

    const profileHash = hashProfile(profileContext)
    const markerContextHash = hashMarkerContext(allResults)

    setPanelOpen(true)
    interpretation.interpret(request, profileHash, markerContextHash)
  }, [test, profile, rangesByBiomarker, interpretation])

  const handlePanelOpenChange = useCallback(
    (open: boolean) => {
      setPanelOpen(open)
      if (!open) {
        interpretation.reset()
      }
    },
    [interpretation]
  )

  return (
    <>
      <FullTestButton
        onClick={handleFullTestInterpret}
        isLoading={interpretation.isLoading}
        isStreaming={interpretation.isStreaming}
      />

      <InterpretationPanel
        open={panelOpen}
        onOpenChange={handlePanelOpenChange}
        title={test.name}
        subtitle={formatShortDate(test.test_date)}
        content={interpretation.content}
        isStreaming={interpretation.isStreaming}
        isLoading={interpretation.isLoading}
        error={interpretation.error}
        cachedAt={interpretation.cachedAt}
        isStale={interpretation.isStale}
        onRegenerate={interpretation.regenerate}
        onAbort={interpretation.abort}
      />
    </>
  )
}
