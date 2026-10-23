'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { Pencil } from 'lucide-react'

import type { BiomarkerUnit, ReferenceRange } from '@/lib/database.types'
import type { TrendData, TrendDataPoint } from '@/lib/analytics/marker-trends'
import { convertValue, formatConverted, normalizeUnit } from '@/lib/grid/unit-conversion'
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
import { findReferenceRange } from '@/lib/grid/reference-range'
import { formatQualified } from '@/lib/blood-tests/qualifier'
import { UserHistory } from '@/components/biomarker/user-history'

interface UnitConversionWrapperProps {
  biomarkerId: string
  /** The catalogue unit (`biomarkers.unit`): shown when there is no preference. */
  defaultUnit: string
  loincCode?: string | null
  /** g/mol, for mass ↔ molar conversion (null when unknown). */
  molarMass?: number | null
  valence?: number | null
  /** The typical mass / molar units for this substance, offered as display units. */
  typicalUnits?: string[]
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

export function UnitConversionWrapper({
  biomarkerId,
  defaultUnit,
  loincCode,
  molarMass,
  valence,
  typicalUnits,
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

  // Display units the user can pick: the catalogue unit, the marker's other
  // known units, and a saved preference (one entry per actual unit).
  const unitOptions = useMemo(() => {
    const out: string[] = []
    for (const u of [defaultUnit, ...availableUnits.map((a) => a.unit), ...(typicalUnits ?? []), initialPreference]) {
      if (u && !out.some((o) => normalizeUnit(o) === normalizeUnit(u))) out.push(u)
    }
    return out
  }, [defaultUnit, availableUnits, typicalUnits, initialPreference])
  const hasMultipleUnits = unitOptions.length > 1

  const ctx = useMemo(
    () => ({
      unit: defaultUnit,
      loinc_code: loincCode ?? null,
      name: markerName,
      molar_mass: molarMass ?? null,
      valence: valence ?? null,
    }),
    [defaultUnit, loincCode, markerName, molarMass, valence]
  )

  /** A value in `fromUnit` in the selected unit, or null when that is not possible. */
  const convert = useCallback(
    (value: number, fromUnit: string): number | null =>
      convertValue(value, fromUnit, selectedUnit, availableUnits, ctx),
    [selectedUnit, availableUnits, ctx]
  )

  // Reference ranges in the selected unit, each converted from its OWN unit.
  // A bound that cannot be converted becomes null rather than a wrong number.
  const displayRanges = useMemo(
    () =>
      ranges.map((r) =>
        normalizeUnit(r.unit) === normalizeUnit(selectedUnit)
          ? { ...r, unit: selectedUnit }
          : {
              ...r,
              range_low: r.range_low != null ? convert(r.range_low, r.unit) : null,
              range_high: r.range_high != null ? convert(r.range_high, r.unit) : null,
              unit: selectedUnit,
            }
      ),
    [ranges, convert, selectedUnit]
  )

  // Every result in the selected unit when possible. A result that cannot be
  // converted keeps its own value and unit, is marked in the table, and stays
  // out of the chart and the range bar so no two units are ever mixed.
  const rows = useMemo(
    () =>
      points.map((p) => {
        const from = p.unit ?? defaultUnit
        const converted = convert(p.value, from)
        return { point: p, from, shown: converted }
      }),
    [points, convert, defaultUnit]
  )
  const displayPoints = useMemo(
    () =>
      rows
        .filter((r) => r.shown !== null)
        .map((r) => ({ ...r.point, value: r.shown as number, unit: selectedUnit })),
    [rows, selectedUnit]
  )
  const skipped = rows.length - displayPoints.length

  // The same pick as the range card: sex-specific before general.
  const chartRange = useMemo(
    () => findReferenceRange(displayRanges, selectedUnit, sex),
    [displayRanges, selectedUnit, sex]
  )

  const latestValue = displayPoints.length > 0
    ? displayPoints[displayPoints.length - 1].value
    : null

  const trendData: TrendData | null =
    displayPoints.length >= 2
      ? {
          points: displayPoints,
          refLow: chartRange.low,
          refHigh: chartRange.high,
          unit: selectedUnit,
          markerName,
          skipped,
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
        <div className="flex items-center justify-end gap-2 -mt-2 mb-4">
          <span className="text-xs text-muted-foreground">Show in</span>
          <Select value={selectedUnit} onValueChange={handleUnitChange}>
            <SelectTrigger className="h-7 w-auto gap-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {unitOptions.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
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

            {rows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">All Results</p>
                <div className="max-h-[240px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Shown in {selectedUnit}</TableHead>
                        <TableHead>As entered</TableHead>
                        <TableHead>Lab / Test</TableHead>
                        <TableHead className="w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...rows].reverse().map(({ point, from, shown }) => (
                        <TableRow key={point.date + point.testName + (point.bloodTestId ?? '')}>
                          <TableCell className="text-sm">{point.date}</TableCell>
                          <TableCell className="text-sm font-medium">
                            {shown !== null ? (
                              <>
                                {formatQualified(formatConverted(shown), point.qualifier)} {selectedUnit}
                              </>
                            ) : (
                              <span
                                className="font-normal text-amber-700 dark:text-amber-400"
                                title={`${from} cannot be converted to ${selectedUnit}`}
                              >
                                not convertible
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatQualified(formatConverted(point.value), point.qualifier)} {from}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {point.testName}
                          </TableCell>
                          <TableCell>
                            {point.bloodTestId && (
                              <Link
                                href={`/tests/${point.bloodTestId}/edit#marker-${biomarkerId}`}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="size-3.5" />
                              </Link>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {skipped > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {skipped} result{skipped === 1 ? '' : 's'} could not be converted to {selectedUnit} and
                    {skipped === 1 ? ' is' : ' are'} left out of the chart.
                  </p>
                )}
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
