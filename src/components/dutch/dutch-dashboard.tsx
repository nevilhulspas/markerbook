'use client'

import { useMemo } from 'react'

import type { Biomarker, Profile, ReferenceRange } from '@/lib/database.types'
import type { DutchTestDetail } from '@/actions/dutch-tests'
import { buildDiurnalData, calculateCAR } from '@/lib/dutch/diurnal-data'
import { RATIO_DISPLAY_CONFIG } from '@/lib/dutch/ratio-display-config'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RatioSlider } from '@/components/dutch/ratio-slider'
import { DiurnalCurveChart } from '@/components/dutch/diurnal-curve-chart'
import { DutchMarkerTable } from '@/components/dutch/dutch-marker-table'

const RATIO_CATEGORY_LABELS: Record<string, string> = {
  estrogen: 'Estrogen Ratios',
  androgen: 'Androgen Ratios',
  progesterone: 'Progesterone Ratios',
  cortisol: 'Cortisol Metabolism',
}

const RATIO_CATEGORY_ORDER = ['estrogen', 'androgen', 'progesterone', 'cortisol']

interface DutchDashboardProps {
  test: DutchTestDetail
  profile: Profile | null
  referenceRanges: ReferenceRange[]
}

export function DutchDashboard({
  test,
  profile,
  referenceRanges,
}: DutchDashboardProps) {
  const sex = (profile?.sex as 'male' | 'female' | null) ?? null
  const phase =
    test.menstrual_phase === 'male' ? null : test.menstrual_phase

  // Extract unique biomarkers for diurnal data
  const biomarkers = useMemo(() => {
    const map = new Map<string, Biomarker>()
    for (const result of test.dutch_test_results) {
      if (!map.has(result.biomarker_id)) {
        map.set(result.biomarker_id, result.biomarkers)
      }
    }
    return Array.from(map.values())
  }, [test.dutch_test_results])

  // Build diurnal data
  const diurnalData = useMemo(
    () =>
      buildDiurnalData(
        test.dutch_test_results,
        biomarkers,
        referenceRanges,
        sex,
        phase
      ),
    [test.dutch_test_results, biomarkers, referenceRanges, sex, phase]
  )

  // Calculate CAR
  const cortisolBiomarker = biomarkers.find(
    (b) => b.name === 'Free Cortisol (Urine)'
  )
  const car = cortisolBiomarker
    ? calculateCAR(test.dutch_test_results, cortisolBiomarker.id)
    : null

  // Group computed ratios by category
  const groupedRatios = useMemo(() => {
    const groups = new Map<
      string,
      { name: string; value: number; config: (typeof RATIO_DISPLAY_CONFIG)[string] }[]
    >()

    for (const cv of test.dutch_computed_values) {
      const config = RATIO_DISPLAY_CONFIG[cv.name]
      if (!config) continue

      const list = groups.get(config.category) ?? []
      list.push({ name: cv.name, value: cv.value, config })
      groups.set(config.category, list)
    }

    return RATIO_CATEGORY_ORDER
      .filter((cat) => groups.has(cat))
      .map((cat) => ({
        category: cat,
        label: RATIO_CATEGORY_LABELS[cat] ?? cat,
        items: groups.get(cat)!,
      }))
  }, [test.dutch_computed_values])

  return (
    <div className="space-y-6">
      {/* Section 1: Diurnal Cortisol Curve (VIS-02) */}
      <Card>
        <CardHeader>
          <CardTitle>Diurnal Cortisol Pattern</CardTitle>
        </CardHeader>
        <CardContent>
          <DiurnalCurveChart data={diurnalData} car={car} />
        </CardContent>
      </Card>

      {/* Section 2: Computed Ratios (VIS-03) */}
      {groupedRatios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Computed Ratios & Metabolism</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {groupedRatios.map((group) => (
              <div key={group.category} className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  {group.label}
                </h3>
                <div className="space-y-4">
                  {group.items.map((item) => (
                    <RatioSlider
                      key={item.name}
                      value={item.value}
                      min={item.config.min}
                      max={item.config.max}
                      refLow={item.config.refLow}
                      refHigh={item.config.refHigh}
                      leftLabel={item.config.leftLabel}
                      rightLabel={item.config.rightLabel}
                      name={item.config.label}
                      unit={item.config.unit}
                      precision={item.config.precision}
                    />
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Section 3: All Markers Table (VIS-04) */}
      <DutchMarkerTable
        testId={test.id}
        results={test.dutch_test_results}
        referenceRanges={referenceRanges}
        sex={sex}
        phase={phase}
      />
    </div>
  )
}
