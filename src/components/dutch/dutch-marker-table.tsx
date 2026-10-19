'use client'

import { Fragment, useMemo } from 'react'
import Link from 'next/link'

import type { DutchTestResultWithBiomarker } from '@/actions/dutch-tests'
import type { ReferenceRange } from '@/lib/database.types'
import {
  getRangeStatusFromRanges,
  getStatusColor,
  getStatusLabel,
} from '@/lib/grid/reference-range'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const CATEGORY_ORDER = [
  'dutch_estrogen',
  'dutch_androgen',
  'dutch_progesterone',
  'dutch_adrenal',
  'dutch_oat',
  'dutch_other',
]

const CATEGORY_LABELS: Record<string, string> = {
  dutch_estrogen: 'Estrogen',
  dutch_androgen: 'Androgens',
  dutch_progesterone: 'Progesterone',
  dutch_adrenal: 'Cortisol & Adrenal',
  dutch_oat: 'Organic Acids',
  dutch_other: 'Other',
}

interface DutchMarkerTableProps {
  testId: string
  results: DutchTestResultWithBiomarker[]
  referenceRanges: ReferenceRange[]
  sex: 'male' | 'female' | null
  phase: string | null
}

export function DutchMarkerTable({
  testId,
  results,
  referenceRanges,
  sex,
  phase,
}: DutchMarkerTableProps) {
  // Group results by category
  const groupedResults = useMemo(() => {
    const map = new Map<string, DutchTestResultWithBiomarker[]>()
    for (const result of results) {
      const category = result.biomarkers.category
      const list = map.get(category) ?? []
      list.push(result)
      map.set(category, list)
    }
    return map
  }, [results])

  // Build range lookup: biomarker_id -> ReferenceRange[]
  const rangesByBiomarker = useMemo(() => {
    const map = new Map<string, ReferenceRange[]>()
    for (const range of referenceRanges) {
      const list = map.get(range.biomarker_id) ?? []
      list.push(range)
      map.set(range.biomarker_id, list)
    }
    return map
  }, [referenceRanges])

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Markers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 text-right font-medium">Value</th>
                <th className="pb-2 pl-2 font-medium">Unit</th>
                <th className="pb-2 pl-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORY_ORDER.map((category) => {
                const categoryResults = groupedResults.get(category)
                if (!categoryResults || categoryResults.length === 0)
                  return null

                return (
                  <Fragment key={category}>
                    {/* Category header row */}
                    <tr>
                      <td
                        colSpan={4}
                        className="bg-muted/30 px-2 py-1.5 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground first:pt-1.5"
                      >
                        {CATEGORY_LABELS[category] ?? category}
                      </td>
                    </tr>

                    {/* Marker rows */}
                    {categoryResults
                      .sort((a, b) => {
                        const nameA =
                          a.biomarkers.short_name ?? a.biomarkers.name
                        const nameB =
                          b.biomarkers.short_name ?? b.biomarkers.name
                        return nameA.localeCompare(nameB)
                      })
                      .map((result) => {
                        const ranges =
                          rangesByBiomarker.get(result.biomarker_id) ?? []
                        const status = getRangeStatusFromRanges(
                          result.value,
                          ranges,
                          result.unit,
                          sex,
                          null,
                          phase
                        )

                        const displayName =
                          result.biomarkers.short_name ??
                          result.biomarkers.name
                        const nameWithTimepoint = result.timepoint
                          ? `${displayName} (${result.timepoint})`
                          : displayName

                        return (
                          <tr
                            key={result.id}
                            className="border-b border-border/50 last:border-0"
                          >
                            <td className="py-2">
                              <Link
                                href={`/dutch/${testId}/marker/${result.biomarker_id}`}
                                className="text-foreground hover:text-primary hover:underline"
                              >
                                {nameWithTimepoint}
                              </Link>
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {result.value}
                            </td>
                            <td className="py-2 pl-2 text-muted-foreground">
                              {result.unit}
                            </td>
                            <td className="py-2 pl-2">
                              <Badge
                                variant="secondary"
                                className={getStatusColor(status)}
                              >
                                {getStatusLabel(status)}
                              </Badge>
                            </td>
                          </tr>
                        )
                      })}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
