'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { Pencil } from 'lucide-react'

import type { BiomarkerUnit, ReferenceRange } from '@/lib/database.types'
import type { TrendData, TrendDataPoint } from '@/lib/analytics/marker-trends'
import { convertValue, normalizeUnit } from '@/lib/grid/unit-conversion'
import { formatConverted } from '@/lib/grid/unit-conversion'
import { setUnitPreference } from '@/actions/unit-preferences'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ReferenceRanges } from '@/components/biomarker/reference-ranges'
import { UserHistory } from '@/components/biomarker/user-history'

interface UnitConversionWrapperProps {
  biomarkerId: string
  defaultUnit: string
  availableUnits: BiomarkerUnit[]
  initialPreference: string | null
  // Reference ranges data
  ranges: ReferenceRange[]
  sex: 'male' | 'female' | null
  // History data
  points: TrendDataPoint[]
  markerName: string
  resultCount: number
  latestDate: string | null
  childBiomarkers?: Array<{ id: string; name: string; short_name: string | null }>
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function UnitConversionWrapper({
  biomarkerId,
  defaultUnit,
  availableUnits,
  initialPreference,
  ranges,
  sex,
  points,
  markerName,
  resultCount,
  latestDate,
  childBiomarkers,
}: UnitConversionWrapperProps) {
  const [selectedUnit, setSelectedUnit] = useState(initialPreference ?? defaultUnit)
  const hasMultipleUnits = availableUnits.length > 1
  const needsConversion = selectedUnit !== defaultUnit

  const convert = useCallback(
    (value: number, fromUnit?: string): number => {
      const from = fromUnit ?? defaultUnit
      if (normalizeUnit(from) === normalizeUnit(selectedUnit)) return value
      const converted = convertValue(value, from, selectedUnit, availableUnits)
      // Un-convertible (stored unit has no catalog factor): keep the original
      // number rather than mislabelling it as the selected unit.
      return converted === null ? value : round1(converted)
    },
    [defaultUnit, selectedUnit, availableUnits]
  )

  // Converted reference ranges
  const displayRanges = useMemo(() => {
    if (!needsConversion) return ranges
    return ranges.map((r) => ({
      ...r,
      range_low: r.range_low != null ? convert(r.range_low) : null,
      range_high: r.range_high != null ? convert(r.range_high) : null,
      unit: selectedUnit,
    }))
  }, [ranges, needsConversion, convert, selectedUnit])

  // Converted trend points (each point may have a different stored unit)
  const displayPoints = useMemo(() => {
    return points.map((p) => ({ ...p, value: convert(p.value, p.unit) }))
  }, [points, convert])

  // Find ref range for trend chart
  const displayRefLow = useMemo(() => {
    const match = displayRanges.find(
      (r) =>
        r.unit === selectedUnit &&
        (r.range_type ?? 'normal') === 'normal' &&
        (sex ? r.sex === sex || r.sex === 'general' : r.sex === 'general')
    )
    return match?.range_low ?? null
  }, [displayRanges, selectedUnit, sex])

  const displayRefHigh = useMemo(() => {
    const match = displayRanges.find(
      (r) =>
        r.unit === selectedUnit &&
        (r.range_type ?? 'normal') === 'normal' &&
        (sex ? r.sex === sex || r.sex === 'general' : r.sex === 'general')
    )
    return match?.range_high ?? null
  }, [displayRanges, selectedUnit, sex])

  const latestValue = displayPoints.length > 0
    ? displayPoints[displayPoints.length - 1].value
    : null

  const trendData: TrendData | null =
    displayPoints.length >= 2
      ? {
          points: displayPoints,
          refLow: displayRefLow,
          refHigh: displayRefHigh,
          unit: selectedUnit,
          markerName,
        }
      : null

  async function handleUnitChange(newUnit: string) {
    setSelectedUnit(newUnit)
    // Save preference in background (for grid), don't block UI
    const pref = newUnit === defaultUnit ? null : newUnit
    setUnitPreference(biomarkerId, pref)
  }

  return (
    <>
      {/* Unit selector — rendered in the header via portal would be complex, so we render it here */}
      {hasMultipleUnits && (
        <div className="flex justify-end -mt-2 mb-4">
          <Select value={selectedUnit} onValueChange={handleUnitChange}>
            <SelectTrigger className="h-7 w-auto gap-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableUnits.map((u) => (
                <SelectItem key={u.unit} value={u.unit}>
                  {u.unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Reference Ranges + Results */}
        <Card>
          <CardHeader>
            <CardTitle>Reference Ranges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ReferenceRanges
              ranges={displayRanges}
              unit={selectedUnit}
              sex={sex}
              latestValue={latestValue}
            />

            {displayPoints.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">All Results</p>
                <div className="max-h-[240px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Original</TableHead>
                        <TableHead>Lab / Test</TableHead>
                        <TableHead className="w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...displayPoints].reverse().map((p, i) => {
                        const original = points[points.length - 1 - i]
                        return (
                        <TableRow key={p.date + p.testName}>
                          <TableCell className="text-sm">{p.date}</TableCell>
                          <TableCell className="text-sm font-medium">
                            {formatConverted(p.value)} {selectedUnit}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {original
                              ? `${formatConverted(original.value)} ${original.unit ?? selectedUnit}`
                              : ''}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {p.testName}
                          </TableCell>
                          <TableCell>
                            {p.bloodTestId && (
                              <Link
                                href={`/tests/${p.bloodTestId}/edit#marker-${biomarkerId}`}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="size-3.5" />
                              </Link>
                            )}
                          </TableCell>
                        </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent>
            <UserHistory
              trendData={trendData}
              resultCount={resultCount}
              latestValue={latestValue}
              latestDate={latestDate}
              unit={selectedUnit}
              childBiomarkers={childBiomarkers}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
