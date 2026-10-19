'use client'

import { useState } from 'react'
import { Search, SlidersHorizontal, Columns3, Download, StickyNote, X } from 'lucide-react'
import type { Table } from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GridFiltersPopover } from './grid-filters'
import type { useGridFilters } from '@/hooks/use-grid-filters'
import type { GridRow } from '@/lib/grid/grid-types'

const COLUMN_LABELS: Record<string, string> = {
  marker_name: 'Marker',
  marker_fullname: 'Full Name',
  marker_unit: 'Unit',
  ref_normal: 'Normal Range',
  ref_optimal: 'Optimal Range',
}

interface GridToolbarProps {
  categories: string[]
  filterActions: ReturnType<typeof useGridFilters>
  table?: Table<GridRow>
  onExportCsv?: () => void
  onExportPdf?: () => void
  onAddAnnotation?: () => void
  showAnnotations?: boolean
  onToggleAnnotations?: (show: boolean) => void
  showSupplements?: boolean
  onToggleSupplements?: (show: boolean) => void
}

export function GridToolbar({ categories, filterActions, table, onExportCsv, onExportPdf, onAddAnnotation, showAnnotations, onToggleAnnotations, showSupplements, onToggleSupplements }: GridToolbarProps) {
  const { filters, setSearch, clearFilters, activeFilterCount } = filterActions
  const [searchValue, setSearchValue] = useState(filters.search ?? '')

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchValue(value)
    setSearch(value)
  }

  const handleClearSearch = () => {
    setSearchValue('')
    setSearch('')
  }

  const hasActiveFilters = activeFilterCount > 0 || !!filters.search

  // Get toggleable columns (exclude test date columns -- those are always shown)
  const toggleableColumns = table
    ? table.getAllColumns().filter((col) => col.id in COLUMN_LABELS && col.getCanHide())
    : []

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      {/* Search input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search markers..."
          value={searchValue}
          onChange={handleSearchChange}
          className="pl-9 pr-8"
        />
        {searchValue && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Filter + View controls */}
      <div className="flex items-center gap-2">
        <GridFiltersPopover
          categories={categories}
          filterActions={filterActions}
        >
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <SlidersHorizontal className="size-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-0.5 size-5 rounded-full p-0 text-[10px]"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </GridFiltersPopover>

        {/* View / column visibility toggle */}
        {table && toggleableColumns.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <Columns3 className="size-4" />
                <span>View</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {toggleableColumns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {COLUMN_LABELS[column.id] ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
              {(onToggleAnnotations || onToggleSupplements) && (
                <>
                  <DropdownMenuSeparator />
                  {onToggleAnnotations && (
                    <DropdownMenuCheckboxItem
                      checked={showAnnotations ?? true}
                      onCheckedChange={(value) => onToggleAnnotations(!!value)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Annotations
                    </DropdownMenuCheckboxItem>
                  )}
                  {onToggleSupplements && (
                    <DropdownMenuCheckboxItem
                      checked={showSupplements ?? true}
                      onCheckedChange={(value) => onToggleSupplements(!!value)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Supplements
                    </DropdownMenuCheckboxItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Annotation add button */}
        {onAddAnnotation && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={onAddAnnotation}
          >
            <StickyNote className="size-4" />
            <span className="hidden sm:inline">Annotation</span>
          </Button>
        )}

        {/* Export dropdown */}
        {(onExportCsv || onExportPdf) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <Download className="size-4" />
                <span>Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Export data</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {onExportCsv && (
                <DropdownMenuItem onClick={onExportCsv}>
                  Export as CSV
                </DropdownMenuItem>
              )}
              {onExportPdf && (
                <DropdownMenuItem onClick={onExportPdf}>
                  Export as PDF
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-muted-foreground"
            onClick={() => {
              clearFilters()
              setSearchValue('')
            }}
          >
            <X className="size-4" />
            <span>Clear</span>
          </Button>
        )}
      </div>
    </div>
  )
}
