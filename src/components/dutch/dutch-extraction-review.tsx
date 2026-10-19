'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'

import type { DutchMarker, MenstrualPhase } from '@/lib/database.types'
import type { DutchMatchedMarker } from '@/lib/dutch/types'
import { matchesBiomarkerQuery } from '@/lib/biomarkers/search'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { ConfidenceBadge } from '@/components/import/confidence-badge'
import { DutchPhaseSelector } from '@/components/dutch/dutch-phase-selector'

export interface DutchImportMetadata {
  testName: string
  date: string
  menstrualPhase: MenstrualPhase | null
  cycleDay: number | null
  storagePath?: string
}

interface DutchExtractionReviewProps {
  markers: DutchMatchedMarker[]
  testDate: string
  patientSex: 'male' | 'female' | 'unknown'
  dutchBiomarkers: DutchMarker[]
  onMarkersChange: (markers: DutchMatchedMarker[]) => void
  onSave: (metadata: DutchImportMetadata) => void
  isSaving: boolean
}

// Category grouping for DUTCH markers
const CATEGORY_LABELS: Record<string, string> = {
  dutch_estrogen: 'Estrogen Metabolites',
  dutch_androgen: 'Androgen Metabolites',
  dutch_progesterone: 'Progesterone Metabolites',
  dutch_adrenal: 'Adrenal Hormones',
  dutch_oat: 'Organic Acids (OATs)',
  dutch_other: 'Other',
}

const CATEGORY_ORDER = [
  'dutch_estrogen',
  'dutch_androgen',
  'dutch_progesterone',
  'dutch_adrenal',
  'dutch_oat',
  'dutch_other',
]

const TIMEPOINT_LABELS: Record<string, string> = {
  waking: 'Waking',
  morning: 'Morning',
  afternoon: 'Afternoon',
  night: 'Night',
}

function biomarkerFilter(biomarker: DutchMarker, query: string): boolean {
  return matchesBiomarkerQuery(biomarker, query)
}

function formatToday(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function DutchExtractionReview({
  markers,
  testDate,
  patientSex,
  dutchBiomarkers,
  onMarkersChange,
  onSave,
  isSaving,
}: DutchExtractionReviewProps) {
  const defaultName = `DUTCH Test - ${testDate ?? 'Unknown Date'}`

  const [testName, setTestName] = useState(defaultName)
  const [date, setDate] = useState(testDate ?? formatToday())
  const [menstrualPhase, setMenstrualPhase] = useState<MenstrualPhase | null>(
    patientSex === 'male' ? 'male' : null
  )
  const [cycleDay, setCycleDay] = useState<number | null>(null)
  const [checkedRows, setCheckedRows] = useState<Set<number>>(new Set())

  const selectedMarkers = markers.filter((m) => m.selected)
  const selectedCount = selectedMarkers.length
  const unmatchedCount = markers.filter((m) => !m.matched).length

  // Build category -> biomarker ID mapping for grouping
  const biomarkerCategoryMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const bm of dutchBiomarkers) {
      map.set(bm.id, bm.category)
    }
    return map
  }, [dutchBiomarkers])

  // Group markers by category
  const groupedMarkers = useMemo(() => {
    const groups = new Map<string, { marker: DutchMatchedMarker; index: number }[]>()

    markers.forEach((marker, index) => {
      const category = marker.biomarker_id
        ? biomarkerCategoryMap.get(marker.biomarker_id) ?? 'dutch_other'
        : 'dutch_other'
      const group = groups.get(category) ?? []
      group.push({ marker, index })
      groups.set(category, group)
    })

    // Sort by defined order
    return CATEGORY_ORDER
      .filter((cat) => groups.has(cat))
      .map((cat) => ({
        category: cat,
        label: CATEGORY_LABELS[cat] ?? cat,
        items: groups.get(cat)!,
      }))
  }, [markers, biomarkerCategoryMap])

  // Check for duplicate biomarker_id + timepoint combos
  const duplicateKeys = useMemo(() => {
    const seen = new Map<string, number>()
    const dupes = new Set<string>()
    for (const m of markers) {
      if (!m.selected || !m.biomarker_id) continue
      const key = `${m.biomarker_id}:${m.timepoint ?? 'null'}`
      seen.set(key, (seen.get(key) ?? 0) + 1)
      if ((seen.get(key) ?? 0) > 1) dupes.add(key)
    }
    return dupes
  }, [markers])

  function updateMarker(index: number, updates: Partial<DutchMatchedMarker>) {
    const updated = markers.map((m, i) =>
      i === index ? { ...m, ...updates } : m
    )
    onMarkersChange(updated)
  }

  function toggleRowChecked(index: number, checked: boolean) {
    setCheckedRows((prev) => {
      const next = new Set(prev)
      if (checked) next.add(index)
      else next.delete(index)
      return next
    })
  }

  function toggleAllChecked(checked: boolean) {
    setCheckedRows(checked ? new Set(markers.map((_, i) => i)) : new Set())
  }

  function deleteCheckedRows() {
    onMarkersChange(markers.filter((_, i) => !checkedRows.has(i)))
    setCheckedRows(new Set())
  }

  function handleBiomarkerMap(index: number, biomarker: DutchMarker | null) {
    if (!biomarker) {
      updateMarker(index, {
        biomarker_id: null,
        catalog_name: null,
        catalog_unit: null,
        matched: false,
      })
      return
    }
    updateMarker(index, {
      biomarker_id: biomarker.id,
      catalog_name: biomarker.name,
      catalog_unit: biomarker.unit,
      matched: true,
    })
  }

  function handleSave() {
    onSave({
      testName,
      date,
      menstrualPhase,
      cycleDay,
    })
  }

  const hasDuplicates = duplicateKeys.size > 0

  return (
    <div className="flex flex-col gap-4">
      {/* Test metadata */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="dutch-import-name" className="text-xs">
            Test Name
          </Label>
          <Input
            id="dutch-import-name"
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dutch-import-date" className="text-xs">
            Collection Date
          </Label>
          <Input
            id="dutch-import-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {/* Phase selector */}
      <DutchPhaseSelector
        phase={menstrualPhase}
        cycleDay={cycleDay}
        onPhaseChange={setMenstrualPhase}
        onCycleDayChange={setCycleDay}
      />

      {/* Unmatched warning */}
      {unmatchedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2.5 dark:border-yellow-800 dark:bg-yellow-950/50">
          <AlertTriangle className="size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {unmatchedCount} unmatched marker{unmatchedCount !== 1 ? 's' : ''}{' '}
            will not be saved. Re-map them to include in the import.
          </p>
        </div>
      )}

      {hasDuplicates && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Duplicate biomarker/timepoint combinations detected. Resolve before
          saving.
        </div>
      )}

      {/* Bulk delete bar */}
      {checkedRows.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-2">
          <p className="text-sm text-muted-foreground">
            {checkedRows.size} row{checkedRows.size !== 1 ? 's' : ''} selected
          </p>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={deleteCheckedRows}
          >
            <Trash2 className="size-4" />
            Delete selected
          </Button>
        </div>
      )}

      {/* Grouped markers table */}
      {groupedMarkers.map((group) => (
        <div key={group.category} className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {group.label}
          </h3>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={
                        checkedRows.size === markers.length &&
                        markers.length > 0
                      }
                      onCheckedChange={(checked) =>
                        toggleAllChecked(checked === true)
                      }
                    />
                  </TableHead>
                  <TableHead className="w-10">Select</TableHead>
                  <TableHead>Extracted Name</TableHead>
                  <TableHead>Matched Biomarker</TableHead>
                  <TableHead className="w-24">Value</TableHead>
                  <TableHead className="w-20">Unit</TableHead>
                  <TableHead className="w-24">Timepoint</TableHead>
                  <TableHead className="w-20">Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.items.map(({ marker, index }) => {
                  const dupeKey = `${marker.biomarker_id}:${marker.timepoint ?? 'null'}`
                  const isDuplicate =
                    marker.selected &&
                    !!marker.biomarker_id &&
                    duplicateKeys.has(dupeKey)

                  return (
                    <TableRow
                      key={index}
                      className={
                        isDuplicate
                          ? 'bg-destructive/10'
                          : !marker.matched
                            ? 'bg-yellow-50 dark:bg-yellow-950/30'
                            : undefined
                      }
                    >
                      <TableCell>
                        <Checkbox
                          checked={checkedRows.has(index)}
                          onCheckedChange={(checked) =>
                            toggleRowChecked(index, checked === true)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={marker.selected}
                          onCheckedChange={(checked) =>
                            updateMarker(index, {
                              selected: checked === true,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {marker.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-2">
                          {!marker.matched && (
                            <AlertTriangle className="mt-2 size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
                          )}
                          <div className="min-w-[180px] flex-1">
                            <Combobox
                              value={
                                marker.biomarker_id
                                  ? dutchBiomarkers.find(
                                      (b) => b.id === marker.biomarker_id
                                    ) ?? null
                                  : null
                              }
                              onValueChange={(b: DutchMarker | null) =>
                                handleBiomarkerMap(index, b)
                              }
                              itemToStringLabel={(b: DutchMarker) => b.name}
                              isItemEqualToValue={(a: DutchMarker, b: DutchMarker) =>
                                a.id === b.id
                              }
                              filter={biomarkerFilter}
                              items={dutchBiomarkers}
                            >
                              <ComboboxInput
                                placeholder="Map to biomarker..."
                                showClear={!!marker.biomarker_id}
                                className="min-w-[180px]"
                              />
                              <ComboboxContent>
                                <ComboboxEmpty>
                                  No DUTCH biomarkers found.
                                </ComboboxEmpty>
                                <ComboboxList>
                                  <ComboboxCollection>
                                    {(biomarker: DutchMarker) => (
                                      <ComboboxItem
                                        key={biomarker.id}
                                        value={biomarker}
                                      >
                                        <div className="flex flex-col">
                                          <span className="font-medium">
                                            {biomarker.name}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            {CATEGORY_LABELS[biomarker.category] ?? biomarker.category}{' '}
                                            &mdash; {biomarker.unit}
                                          </span>
                                        </div>
                                      </ComboboxItem>
                                    )}
                                  </ComboboxCollection>
                                </ComboboxList>
                              </ComboboxContent>
                            </Combobox>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          className="h-8 w-24"
                          value={marker.value}
                          onChange={(e) => {
                            const parsed = parseFloat(e.target.value)
                            if (!Number.isNaN(parsed)) {
                              updateMarker(index, { value: parsed })
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {marker.unit}
                        </span>
                      </TableCell>
                      <TableCell>
                        {marker.timepoint ? (
                          <Badge variant="outline" className="text-xs">
                            {TIMEPOINT_LABELS[marker.timepoint] ??
                              marker.timepoint}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ConfidenceBadge confidence={marker.confidence} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}

      {/* Summary and save */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedCount} of {markers.length} markers selected
        </p>
        <Button
          onClick={handleSave}
          disabled={selectedCount === 0 || isSaving || hasDuplicates}
        >
          {isSaving && <Loader2 className="size-4 animate-spin" />}
          Import {selectedCount} Marker{selectedCount !== 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  )
}
