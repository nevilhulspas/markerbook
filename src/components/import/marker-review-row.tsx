'use client'

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  GripVertical,
  Plus,
  PlusCircle,
  Trash2,
} from 'lucide-react'

import type { Biomarker, BiomarkerUnit } from '@/lib/database.types'
import { isConvertible } from '@/lib/units/convert'
import { markerUnitsFor } from '@/lib/units/result-range'
import type { MatchedMarker } from '@/lib/extraction/types'
import { matchesBiomarkerQuery } from '@/lib/biomarkers/search'
import {
  getMarkerResolution,
  unitFilter,
  type UnitOption,
} from '@/lib/import/marker-list-ops'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { TableCell, TableRow } from '@/components/ui/table'
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Badge } from '@/components/ui/badge'
import { ConfidenceBadge } from '@/components/import/confidence-badge'

function biomarkerFilter(biomarker: Biomarker, query: string): boolean {
  // Always show "Create new" option
  if (biomarker.id === '__create_new__') return true
  return matchesBiomarkerQuery(biomarker, query)
}

interface MarkerReviewRowProps {
  marker: MatchedMarker
  isFirst: boolean
  isLast: boolean
  checked: boolean
  hasDuplicateSelection: boolean
  /** Biomarker options including the "Create new" sentinel. */
  biomarkerOptions: Biomarker[]
  unitOptions: UnitOption[]
  /** Unit options including the "Create new unit" sentinel. */
  unitOptionsWithCreate: UnitOption[]
  onCheckedChange: (checked: boolean) => void
  onMove: (direction: 'up' | 'down') => void
  onInsert: (position: 'above' | 'below') => void
  onDelete: () => void
  onBiomarkerMap: (biomarker: Biomarker | null) => void
  onValueChange: (value: number) => void
  onUnitChange: (unit: UnitOption | null) => void
}

/** One extracted marker in the import review table. */
export function MarkerReviewRow({
  marker,
  isFirst,
  isLast,
  checked,
  hasDuplicateSelection,
  biomarkerOptions,
  unitOptions,
  unitOptionsWithCreate,
  onCheckedChange,
  onMove,
  onInsert,
  onDelete,
  onBiomarkerMap,
  onValueChange,
  onUnitChange,
}: MarkerReviewRowProps) {
  // Capturable / custom markers look "resolved" for styling — they auto-save.
  const resolution = getMarkerResolution(marker)
  const isCapturable = resolution === 'capturable'
  const isCustom = resolution === 'custom'
  const isUnresolved = resolution === 'unresolved'

  return (
    <TableRow
      className={
        hasDuplicateSelection
          ? 'bg-destructive/10'
          : isUnresolved
            ? 'bg-yellow-50 dark:bg-yellow-950/30'
            : undefined
      }
    >
      <TableCell>
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
        />
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
              <GripVertical className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem
              onClick={() => onMove('up')}
              disabled={isFirst}
            >
              <ArrowUp className="size-4" />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onMove('down')}
              disabled={isLast}
            >
              <ArrowDown className="size-4" />
              Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onInsert('above')}>
              <PlusCircle className="size-4" />
              Add row above
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onInsert('below')}>
              <PlusCircle className="size-4" />
              Add row below
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4" />
              Delete row
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
      <TableCell className="font-medium">{marker.name}</TableCell>
      <TableCell>
        {isCapturable || isCustom ? (
          // Capturable/custom: display as resolved with a "new marker" badge
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{isCapturable ? (marker.catalog_name ?? marker.name) : marker.name}</span>
            <Badge variant="secondary" className="text-[10px]">
              {isCapturable ? 'New marker, added on save' : 'New custom marker, added on save'}
            </Badge>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            {isUnresolved && (
              <AlertTriangle className="mt-2 size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
            )}
            <div className="min-w-[180px] flex-1 space-y-1">
              <Combobox
                value={
                  marker.biomarker_id
                    ? biomarkerOptions.find(
                        (b) => b.id === marker.biomarker_id
                      ) ?? null
                    : null
                }
                onValueChange={(b: Biomarker | null) => onBiomarkerMap(b)}
                itemToStringLabel={(b: Biomarker) => b.name}
                isItemEqualToValue={(a: Biomarker, b: Biomarker) =>
                  a.id === b.id
                }
                filter={biomarkerFilter}
                items={biomarkerOptions}
              >
                <ComboboxInput
                  placeholder="Map to biomarker..."
                  showClear={!!marker.biomarker_id}
                  className="min-w-[180px]"
                />
                <ComboboxContent>
                  <ComboboxEmpty>No biomarkers found.</ComboboxEmpty>
                  <ComboboxList>
                    <ComboboxCollection>
                      {(biomarker: Biomarker) => (
                        <ComboboxItem
                          key={biomarker.id}
                          value={biomarker}
                        >
                          {biomarker.id === '__create_new__' ? (
                            <div className="flex items-center gap-2 text-primary">
                              <Plus className="size-4" />
                              <span className="font-medium">
                                Create new biomarker
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {biomarker.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {biomarker.category} &mdash;{' '}
                                {biomarker.unit}
                              </span>
                            </div>
                          )}
                        </ComboboxItem>
                      )}
                    </ComboboxCollection>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>

              {hasDuplicateSelection ? (
                <p className="max-w-full whitespace-normal break-words text-xs text-destructive">
                  Duplicate mapping. Choose another biomarker or delete one row.
                </p>
              ) : isUnresolved ? (
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  This row needs to be mapped before it can be saved.
                </p>
              ) : null}
            </div>
          </div>
        )}
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
              onValueChange(parsed)
            }
          }}
        />
      </TableCell>
      <TableCell>
        {(() => {
          // Warn when the value's unit cannot be shown in the marker's unit:
          // it is still saved as entered, but stays out of charts and
          // comparisons until the marker has a conversion for it.
          const bm = marker.biomarker_id
            ? (biomarkerOptions.find((b) => b.id === marker.biomarker_id) as
                | (Biomarker & { biomarker_units?: BiomarkerUnit[] })
                | undefined)
            : undefined
          if (!bm || !marker.unit || !bm.unit) return null
          if (isConvertible(marker.unit, markerUnitsFor(bm, bm.biomarker_units))) return null
          return (
            <p className="mb-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3 shrink-0" />
              Can&apos;t convert to {bm.unit}
            </p>
          )
        })()}
        <Combobox
          value={
            marker.unit
              ? unitOptions.find((u) => u.value === marker.unit) ?? { value: marker.unit, label: marker.unit }
              : null
          }
          onValueChange={(u: UnitOption | null) => onUnitChange(u)}
          itemToStringLabel={(u: UnitOption) => u.label}
          isItemEqualToValue={(a: UnitOption, b: UnitOption) =>
            a.value === b.value
          }
          filter={unitFilter}
          items={unitOptionsWithCreate}
        >
          <ComboboxInput
            placeholder={marker.catalog_unit ?? 'Unit...'}
            className="h-8 w-28"
          />
          <ComboboxContent>
            <ComboboxEmpty>No units found.</ComboboxEmpty>
            <ComboboxList>
              <ComboboxCollection>
                {(unit: UnitOption) =>
                  unit.value === '__create_new_unit__' ? (
                    <ComboboxItem key={unit.value} value={unit}>
                      <span className="flex items-center gap-2 text-primary">
                        <Plus className="size-3" />
                        <span className="font-medium">
                          Create new unit
                        </span>
                      </span>
                    </ComboboxItem>
                  ) : (
                    <ComboboxItem key={unit.value} value={unit}>
                      {unit.label}
                    </ComboboxItem>
                  )
                }
              </ComboboxCollection>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </TableCell>
      <TableCell>
        <ConfidenceBadge confidence={marker.confidence} />
      </TableCell>
    </TableRow>
  )
}
