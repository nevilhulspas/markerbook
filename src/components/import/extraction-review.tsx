'use client'

import { useMemo, useState } from 'react'
import { Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import type { Biomarker } from '@/lib/database.types'
import type { MatchedMarker } from '@/lib/extraction/types'
import { prepareMarkersForSave } from '@/lib/import/prepare-markers-for-save'
import {
  applyCreatedBiomarkers,
  biomarkerMappingUpdates,
  buildUnitOptions,
  createEmptyMarker,
  getMarkerResolution,
  hasDuplicateSelection,
  insertEmptyMarker,
  mergeLocalBiomarkers,
  moveMarkerAt,
  removeMarkerAt,
  removeMarkersAt,
  rowKeyOf,
  updateMarkerAt,
  type UnitOption,
} from '@/lib/import/marker-list-ops'
import { createBiomarkers } from '@/actions/blood-tests'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CreateBiomarkerDialog,
  guessCategory,
} from '@/components/import/create-biomarker-dialog'
import { MarkerReviewRow } from '@/components/import/marker-review-row'
import { CreateUnitDialog } from '@/components/ui/create-unit-dialog'

// Sentinel value for "Create new biomarker" option
const CREATE_NEW_BIOMARKER: Biomarker = {
  id: '__create_new__',
  name: '+ Create new biomarker',
  short_name: null,
  category: '',
  unit: '',
  is_custom: false,
  description: null,
  ref_range_low: null,
  ref_range_high: null,
  ref_range_low_male: null,
  ref_range_high_male: null,
  ref_range_low_female: null,
  ref_range_high_female: null,
  range_source: null,
  aliases: [],
  parent_id: null,
  variant_name: null,
  panel_id: null,
  archived_at: null,
  loinc_code: null,
  method: null,
  created_at: '',
}

const CREATE_NEW_UNIT: UnitOption = {
  value: '__create_new_unit__',
  label: '+ Create new unit',
}

export interface ImportMetadata {
  testName: string
  date: string
  sampleType: 'serum' | 'plasma' | 'unknown'
}

interface ExtractionReviewProps {
  markers: MatchedMarker[]
  testDate: string | null
  labName: string | null
  sampleType: 'serum' | 'plasma' | 'unknown'
  biomarkers: Biomarker[]
  onMarkersChange: (markers: MatchedMarker[]) => void
  onSave: (metadata: ImportMetadata) => void
  isSaving: boolean
}

export function ExtractionReview({
  markers,
  testDate,
  labName,
  sampleType: initialSampleType,
  biomarkers,
  onMarkersChange,
  onSave,
  isSaving,
}: ExtractionReviewProps) {
  const defaultName = labName
    ? `${labName} - ${testDate ?? 'Unknown Date'}`
    : `Lab Report - ${testDate ?? 'Unknown Date'}`

  const [testName, setTestName] = useState(defaultName)
  const [date, setDate] = useState(testDate ?? '')
  const [sampleType, setSampleType] = useState(initialSampleType)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createDialogIndex, setCreateDialogIndex] = useState<number | null>(null)
  const [createUnitOpen, setCreateUnitOpen] = useState(false)
  const [createUnitIndex, setCreateUnitIndex] = useState<number | null>(null)
  const [localUnits, setLocalUnits] = useState<string[]>([])
  const [localBiomarkers, setLocalBiomarkers] = useState<Biomarker[]>([])
  const [isAutoCreating, setIsAutoCreating] = useState(false)
  // Checked rows by row key, so a check follows its row through moves/inserts.
  const [checkedRows, setCheckedRows] = useState<Set<string>>(new Set())

  const selectedCount = markers.length
  // Capturable: resolved to a new LOINC code — auto-saved by commitCapture, no manual action needed.
  const capturableMarkers = markers.filter((m) => getMarkerResolution(m) === 'capturable')
  // Custom: no catalog/LOINC match — auto-saved as a custom (non-LOINC) biomarker on save.
  const customMarkers = markers.filter((m) => getMarkerResolution(m) === 'custom')
  // Unresolved: could not be placed at all — require manual mapping or auto-create.
  const unresolvedMarkers = markers.filter((m) => getMarkerResolution(m) === 'unresolved')
  const { duplicateBiomarkerIds, duplicateNames } = useMemo(
    () => prepareMarkersForSave(markers),
    [markers]
  )
  const duplicateIdSet = useMemo(
    () => new Set(duplicateBiomarkerIds),
    [duplicateBiomarkerIds]
  )

  // Build unique unit options from catalog + extracted markers + locally created
  const unitOptions = useMemo(
    () => buildUnitOptions(biomarkers, markers, localUnits),
    [biomarkers, markers, localUnits]
  )

  const unitOptionsWithCreate = useMemo(
    () => [CREATE_NEW_UNIT, ...unitOptions],
    [unitOptions]
  )

  // Biomarker options with locally created ones + "Create new" at the top
  const allBiomarkers = useMemo(
    () => mergeLocalBiomarkers(biomarkers, localBiomarkers),
    [biomarkers, localBiomarkers]
  )

  const biomarkerOptionsWithCreate = useMemo(
    () => [CREATE_NEW_BIOMARKER, ...allBiomarkers],
    [allBiomarkers]
  )

  function updateMarker(index: number, updates: Partial<MatchedMarker>) {
    onMarkersChange(updateMarkerAt(markers, index, updates))
  }

  function deleteMarker(index: number) {
    onMarkersChange(removeMarkerAt(markers, index))
    setCheckedRows(new Set())
  }

  function toggleRowChecked(rowKey: string, checked: boolean) {
    setCheckedRows((prev) => {
      const next = new Set(prev)
      if (checked) next.add(rowKey)
      else next.delete(rowKey)
      return next
    })
  }

  function toggleAllChecked(checked: boolean) {
    setCheckedRows(checked ? new Set(markers.map((m, i) => rowKeyOf(m, i))) : new Set())
  }

  // Only keys of rows that still exist count (a deleted row's key can linger).
  const checkedIndexes = useMemo(
    () =>
      new Set(
        markers.flatMap((m, i) => (checkedRows.has(rowKeyOf(m, i)) ? [i] : []))
      ),
    [markers, checkedRows]
  )

  function deleteCheckedRows() {
    onMarkersChange(removeMarkersAt(markers, checkedIndexes))
    setCheckedRows(new Set())
  }

  function insertMarker(index: number, position: 'above' | 'below') {
    onMarkersChange(insertEmptyMarker(markers, index, position))
  }

  function moveMarker(index: number, direction: 'up' | 'down') {
    const newMarkers = moveMarkerAt(markers, index, direction)
    if (newMarkers) onMarkersChange(newMarkers)
  }

  function handleBiomarkerMap(index: number, biomarker: Biomarker | null) {
    if (!biomarker) {
      updateMarker(index, biomarkerMappingUpdates(null))
      return
    }

    if (biomarker.id === '__create_new__') {
      setCreateDialogIndex(index)
      setCreateDialogOpen(true)
      return
    }
    updateMarker(index, biomarkerMappingUpdates(biomarker))
  }

  function handleBiomarkerCreated(biomarker: Biomarker) {
    setLocalBiomarkers((prev) => [...prev, biomarker])
    if (createDialogIndex !== null) {
      updateMarker(createDialogIndex, biomarkerMappingUpdates(biomarker))
    }
  }

  function handleUnitChange(index: number, unit: UnitOption | null) {
    if (!unit) return
    if (unit.value === '__create_new_unit__') {
      setCreateUnitIndex(index)
      setCreateUnitOpen(true)
      return
    }
    updateMarker(index, { unit: unit.value })
  }

  function handleUnitCreated(newUnit: string) {
    setLocalUnits((prev) => [...prev, newUnit])
    if (createUnitIndex !== null) {
      updateMarker(createUnitIndex, { unit: newUnit })
    }
  }

  async function handleAutoCreateAll() {
    if (unresolvedMarkers.length === 0) return

    setIsAutoCreating(true)

    const toCreate = unresolvedMarkers.map((m) => ({
      name: m.name,
      category: guessCategory(m.name) || 'Other',
      unit: m.unit,
    }))

    const result = await createBiomarkers(toCreate)
    setIsAutoCreating(false)

    if (result.success) {
      setLocalBiomarkers((prev) => [...prev, ...result.biomarkers])

      // Map created biomarkers back to their marker rows
      onMarkersChange(applyCreatedBiomarkers(markers, result.biomarkers))
      toast.success(`Created ${result.biomarkers.length} biomarker${result.biomarkers.length !== 1 ? 's' : ''}`)
    } else {
      toast.error(result.error)
    }
  }

  function handleSave() {
    onSave({ testName, date, sampleType })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Test metadata */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="import-name" className="text-xs">
            Test Name
          </Label>
          <Input
            id="import-name"
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="import-date" className="text-xs">
            Test Date
          </Label>
          <Input
            id="import-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="import-sample-type" className="text-xs">
            Sample Type
          </Label>
          <Select
            value={sampleType}
            onValueChange={(val) =>
              setSampleType(val as 'serum' | 'plasma' | 'unknown')
            }
          >
            <SelectTrigger id="import-sample-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unknown">Unknown</SelectItem>
              <SelectItem value="serum">Serum</SelectItem>
              <SelectItem value="plasma">Plasma</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Capturable (LOINC auto-add) info bar */}
      {capturableMarkers.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 dark:border-blue-800 dark:bg-blue-950/50">
          <Sparkles className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {capturableMarkers.length} new LOINC marker
            {capturableMarkers.length !== 1 ? 's' : ''} will be added automatically on save.
          </p>
        </div>
      )}

      {/* Custom (non-LOINC auto-add) info bar */}
      {customMarkers.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 dark:border-violet-800 dark:bg-violet-950/50">
          <Sparkles className="size-4 shrink-0 text-violet-600 dark:text-violet-400" />
          <p className="text-sm text-violet-800 dark:text-violet-200">
            {customMarkers.length} custom marker
            {customMarkers.length !== 1 ? 's' : ''} will be added automatically on save.
          </p>
        </div>
      )}

      {/* Unmatched action bar — unresolved markers only */}
      {unresolvedMarkers.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2.5 dark:border-yellow-800 dark:bg-yellow-950/50">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {unresolvedMarkers.length} unmatched biomarker
            {unresolvedMarkers.length !== 1 ? 's' : ''}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoCreateAll}
            disabled={isAutoCreating}
          >
            {isAutoCreating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Create all missing
          </Button>
        </div>
      )}

      {duplicateNames.length > 0 && (
        <div className="max-w-full rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="whitespace-normal break-words">
            Resolve duplicate mappings before saving: {duplicateNames.join(', ')}.
            Remap one highlighted row or delete the extra one.
          </p>
        </div>
      )}

      {/* Bulk delete bar */}
      {checkedIndexes.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-2">
          <p className="text-sm text-muted-foreground">
            {checkedIndexes.size} row{checkedIndexes.size !== 1 ? 's' : ''} selected
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

      {/* Markers table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={checkedIndexes.size === markers.length && markers.length > 0}
                  onCheckedChange={(checked) => toggleAllChecked(checked === true)}
                />
              </TableHead>
              <TableHead className="w-10" />
              <TableHead>Extracted Name</TableHead>
              <TableHead>Matched Biomarker</TableHead>
              <TableHead className="w-24">Value</TableHead>
              <TableHead className="w-24">Unit</TableHead>
              <TableHead className="w-20">Confidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {markers.map((marker, index) => (
              <MarkerReviewRow
                key={rowKeyOf(marker, index)}
                marker={marker}
                isFirst={index === 0}
                isLast={index === markers.length - 1}
                checked={checkedIndexes.has(index)}
                hasDuplicateSelection={hasDuplicateSelection(marker, duplicateIdSet)}
                biomarkerOptions={biomarkerOptionsWithCreate}
                unitOptions={unitOptions}
                unitOptionsWithCreate={unitOptionsWithCreate}
                onCheckedChange={(checked) => toggleRowChecked(rowKeyOf(marker, index), checked)}
                onMove={(direction) => moveMarker(index, direction)}
                onInsert={(position) => insertMarker(index, position)}
                onDelete={() => deleteMarker(index)}
                onBiomarkerMap={(b) => handleBiomarkerMap(index, b)}
                onValueChange={(value) => updateMarker(index, { value })}
                onUnitChange={(u) => handleUnitChange(index, u)}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add marker + summary and save */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onMarkersChange([...markers, createEmptyMarker()])
            }}
          >
            <Plus className="size-4" />
            Add Marker
          </Button>
          <p className="text-sm text-muted-foreground">
            {selectedCount} of {markers.length} markers selected
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={selectedCount === 0 || isSaving || duplicateNames.length > 0}
        >
          {isSaving && <Loader2 className="size-4 animate-spin" />}
          Import {selectedCount} Marker{selectedCount !== 1 ? 's' : ''}
        </Button>
      </div>

      <CreateBiomarkerDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultName={
          createDialogIndex !== null ? markers[createDialogIndex].name : ''
        }
        defaultUnit={
          createDialogIndex !== null ? markers[createDialogIndex].unit : ''
        }
        defaultCategory={
          createDialogIndex !== null
            ? guessCategory(markers[createDialogIndex].name)
            : ''
        }
        unitOptions={unitOptions.map((u) => u.value)}
        onCreated={handleBiomarkerCreated}
      />

      <CreateUnitDialog
        open={createUnitOpen}
        onOpenChange={setCreateUnitOpen}
        onCreated={handleUnitCreated}
      />
    </div>
  )
}
