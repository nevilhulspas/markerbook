'use client'

import { useCallback, useState } from 'react'

import type { BiomarkerUnit, Profile, ReferenceRange } from '@/lib/database.types'
import type { BloodTestWithResults } from '@/actions/blood-tests'
import { toMarkerContext } from '@/lib/interpretation/marker-context'
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
  /** biomarker_units per biomarker, for unit conversion. */
  unitsByBiomarker?: Map<string, BiomarkerUnit[]>
  /** False when the server has no Anthropic key (isAiConfigured). */
  aiEnabled?: boolean
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
  unitsByBiomarker,
  aiEnabled = true,
}: TestDetailClientProps) {
  const interpretation = useInterpretation({ aiEnabled })
  const [panelOpen, setPanelOpen] = useState(false)

  const handleFullTestInterpret = useCallback(() => {
    const rangeSex =
      profile?.sex === 'male' || profile?.sex === 'female'
        ? profile.sex
        : null
    const allResults: MarkerContext[] = test.test_results.map((r) =>
      toMarkerContext(
        r,
        rangesByBiomarker?.get(r.biomarkers.id) ?? [],
        unitsByBiomarker?.get(r.biomarkers.id),
        rangeSex
      )
    )

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
  }, [test, profile, rangesByBiomarker, unitsByBiomarker, interpretation])

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
        aiEnabled={aiEnabled}
      />

      <InterpretationPanel
        aiEnabled={aiEnabled}
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
