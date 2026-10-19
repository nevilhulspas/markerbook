'use client'

import { useCallback, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'

import type { Biomarker, BiomarkerUnit } from '@/lib/database.types'
import type { MarkerEntryValues } from '@/lib/validations/blood-test'
import { matchesBiomarkerQuery } from '@/lib/biomarkers/search'
import { inputUnitOptions } from '@/lib/units/convert'
import { markerUnitsFor } from '@/lib/units/result-range'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import {
  CreateBiomarkerDialog,
  guessCategory,
} from '@/components/import/create-biomarker-dialog'

interface BiomarkerWithUnits extends Biomarker {
  biomarker_units?: BiomarkerUnit[]
}

interface MarkerEntryProps {
  biomarkers: Biomarker[]
  value: MarkerEntryValues | null
  onChange: (entry: MarkerEntryValues) => void
  onRemove: () => void
  excludeIds: string[]
  highlighted?: boolean
  /** Called when a marker is created inline so the parent can add it to the
   *  catalogue list (making it selectable across rows). */
  onBiomarkerCreated?: (biomarker: Biomarker) => void
}

function biomarkerFilter(biomarker: Biomarker, query: string): boolean {
  return matchesBiomarkerQuery(biomarker, query, { includeVariantName: true })
}

export function MarkerEntry({
  biomarkers,
  value,
  onChange,
  onRemove,
  excludeIds,
  highlighted,
  onBiomarkerCreated,
}: MarkerEntryProps) {
  const available = biomarkers.filter((b) => !excludeIds.includes(b.id))

  // Track the typed query so the empty state can explain WHY nothing matched
  // (already on this test) and pre-fill the create-marker dialog.
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const trimmedQuery = query.trim()

  // A query that matches a biomarker we EXCLUDED because it's already on this
  // test — surfaced as a clearer message than a bare "No biomarkers found".
  const alreadyAddedMatch = trimmedQuery
    ? (biomarkers.find(
        (b) => excludeIds.includes(b.id) && biomarkerFilter(b, trimmedQuery)
      ) ?? null)
    : null

  // Only an EXACT (name/short_name) match to an already-added marker suppresses
  // the "Add" affordance — so we never offer a literal duplicate, but a query
  // that merely substring-matches an existing marker (e.g. "Selenium (High
  // Dose)" when "Selenium" is on the test) can still be created.
  const exactAlreadyAdded =
    alreadyAddedMatch != null &&
    biomarkers.some(
      (b) =>
        excludeIds.includes(b.id) &&
        (b.name.trim().toLowerCase() === trimmedQuery.toLowerCase() ||
          b.short_name?.trim().toLowerCase() === trimmedQuery.toLowerCase())
    )

  // Distinct catalogue units, offered as choices when creating a new marker.
  const unitOptions = useMemo(
    () =>
      Array.from(
        new Set(biomarkers.map((b) => b.unit).filter((u): u is string => u.length > 0))
      ).sort(),
    [biomarkers]
  )

  // Group biomarkers by parent for ordered autocomplete display
  const groupedBiomarkers = useMemo(() => {
    // Find parent IDs that have children
    const parentIds = new Set(
      available.filter((b) => b.parent_id != null).map((b) => b.parent_id!)
    )

    // Separate: standalone (no parent, not a parent), parents, variants
    const standalone = available.filter(
      (b) => !b.parent_id && !parentIds.has(b.id)
    )
    const parents = available.filter((b) => parentIds.has(b.id))
    const variantsByParent = new Map<string, Biomarker[]>()

    for (const b of available) {
      if (b.parent_id) {
        const list = variantsByParent.get(b.parent_id) ?? []
        list.push(b)
        variantsByParent.set(b.parent_id, list)
      }
    }

    // Build ordered list by category
    const allByCategory = new Map<
      string,
      { standalone: Biomarker[]; parentGroups: { parent: Biomarker; variants: Biomarker[] }[] }
    >()

    for (const b of standalone) {
      const cat = allByCategory.get(b.category) ?? { standalone: [], parentGroups: [] }
      cat.standalone.push(b)
      allByCategory.set(b.category, cat)
    }

    for (const p of parents) {
      const cat = allByCategory.get(p.category) ?? { standalone: [], parentGroups: [] }
      const variants = variantsByParent.get(p.id) ?? []
      cat.parentGroups.push({ parent: p, variants })
      allByCategory.set(p.category, cat)
    }

    // Flatten: sorted by category, then standalone + parent groups by name
    const result: Biomarker[] = []
    const sortedCategories = Array.from(allByCategory.keys()).sort()

    for (const category of sortedCategories) {
      const cat = allByCategory.get(category)!
      const sortedStandalone = cat.standalone.sort((a, b) =>
        a.name.localeCompare(b.name)
      )
      result.push(...sortedStandalone)

      const sortedGroups = cat.parentGroups.sort((a, b) =>
        a.parent.name.localeCompare(b.parent.name)
      )
      for (const group of sortedGroups) {
        // Only add variants (parent itself is not selectable)
        const sortedVariants = group.variants.sort((a, b) =>
          a.name.localeCompare(b.name)
        )
        result.push(...sortedVariants)
      }
    }

    return result
  }, [available])

  const selectedBiomarker = value
    ? biomarkers.find((b) => b.id === value.biomarker_id) ?? null
    : null

  const [numericValue, setNumericValue] = useState<string>(
    value?.value != null && value.value > 0 ? String(value.value) : ''
  )
  const [unit, setUnit] = useState<string>(value?.unit ?? '')

  const handleBiomarkerSelect = useCallback(
    (biomarker: Biomarker | null) => {
      if (!biomarker) return
      const newUnit = biomarker.unit
      setUnit(newUnit)

      const parsed = parseFloat(numericValue)
      onChange({
        biomarker_id: biomarker.id,
        value: Number.isNaN(parsed) || parsed <= 0 ? 0 : parsed,
        unit: newUnit,
      })
    },
    [numericValue, onChange]
  )

  function handleBiomarkerCreated(biomarker: Biomarker) {
    // Lift into the catalogue list (so it's selectable elsewhere) and select it
    // into this row.
    onBiomarkerCreated?.(biomarker)
    handleBiomarkerSelect(biomarker)
  }

  function handleValueChange(raw: string) {
    setNumericValue(raw)
    if (!value) return
    const parsed = parseFloat(raw)
    if (!Number.isNaN(parsed) && parsed > 0) {
      onChange({ ...value, value: parsed })
    }
  }

  function handleUnitChange(newUnit: string) {
    setUnit(newUnit)
    if (!value) return
    onChange({ ...value, unit: newUnit })
  }

  // The units a value can be entered in for this marker: its catalogue unit
  // and its known units (one entry per actual unit), plus the current unit.
  // This is the INPUT unit; how a value is shown is chosen on the grid and
  // the marker page.
  const availableUnits = useMemo(() => {
    if (!selectedBiomarker) return []
    const bm = selectedBiomarker as BiomarkerWithUnits
    return inputUnitOptions(markerUnitsFor(bm, bm.biomarker_units), unit)
  }, [selectedBiomarker, unit])

  return (
    <div
      id={value?.biomarker_id ? `marker-${value.biomarker_id}` : undefined}
      className={cn(
        'flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-end sm:gap-3',
        highlighted && 'ring-2 ring-primary'
      )}
    >
      <div className="flex-1 space-y-1">
        <Label className="text-xs text-muted-foreground">Biomarker</Label>
        <Combobox
          value={selectedBiomarker}
          onValueChange={handleBiomarkerSelect}
          onInputValueChange={setQuery}
          itemToStringLabel={(b: Biomarker) => b.name}
          isItemEqualToValue={(a: Biomarker, b: Biomarker) => a.id === b.id}
          filter={biomarkerFilter}
          items={groupedBiomarkers}
        >
          <ComboboxInput
            placeholder="Search biomarker..."
            showClear={!!selectedBiomarker}
          />
          <ComboboxContent>
            <ComboboxEmpty>
              <div className="flex flex-col items-center gap-1">
                {alreadyAddedMatch && (
                  <span>
                    “{alreadyAddedMatch.name}” is already on this test.
                  </span>
                )}
                {!exactAlreadyAdded && (
                  <button
                    type="button"
                    // Keep input focus so the popup doesn't dismiss before the
                    // click opens the create dialog.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <Plus className="size-3.5" />
                    {trimmedQuery
                      ? `Add “${trimmedQuery}” as a new marker`
                      : 'Add a new marker'}
                  </button>
                )}
              </div>
            </ComboboxEmpty>
            <ComboboxList>
              <ComboboxCollection>
                {(biomarker: Biomarker) => (
                  <ComboboxItem key={biomarker.id} value={biomarker}>
                    <div className="flex flex-col">
                      <span className={cn('font-medium', biomarker.parent_id && 'pl-3')}>
                        {biomarker.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {biomarker.category} &mdash; {biomarker.unit}
                      </span>
                    </div>
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      <div className="w-full space-y-1 sm:w-28">
        <Label className="text-xs text-muted-foreground">Value</Label>
        <Input
          type="number"
          step="any"
          min="0"
          placeholder="0.00"
          value={numericValue}
          onChange={(e) => handleValueChange(e.target.value)}
        />
      </div>

      <div className="w-full space-y-1 sm:w-28">
        <Label className="text-xs text-muted-foreground">Entered in</Label>
        {availableUnits.length > 1 ? (
          <Select value={unit} onValueChange={handleUnitChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="unit" />
            </SelectTrigger>
            <SelectContent>
              {availableUnits.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            placeholder="unit"
            value={unit}
            readOnly
            className="bg-muted text-muted-foreground cursor-default"
          />
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 self-end text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        aria-label="Remove marker"
      >
        <X className="size-4" />
      </Button>

      <CreateBiomarkerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultName={trimmedQuery}
        defaultUnit=""
        defaultCategory={guessCategory(trimmedQuery)}
        unitOptions={unitOptions}
        onCreated={handleBiomarkerCreated}
      />
    </div>
  )
}
