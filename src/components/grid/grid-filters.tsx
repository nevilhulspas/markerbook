'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import type { useGridFilters } from '@/hooks/use-grid-filters'
import type { GridFilters } from '@/lib/validations/grid-filters'

type StatusOption = NonNullable<GridFilters['status']>[number]

const STATUS_OPTIONS: { value: StatusOption; label: string; colorClass: string }[] = [
  { value: 'normal', label: 'Normal', colorClass: 'bg-green-500' },
  { value: 'borderline', label: 'Borderline', colorClass: 'bg-yellow-500' },
  { value: 'out-of-range', label: 'Out of Range', colorClass: 'bg-red-500' },
  { value: 'unknown', label: 'No Reference', colorClass: 'bg-gray-400' },
]

interface GridFiltersPopoverProps {
  categories: string[]
  filterActions: ReturnType<typeof useGridFilters>
  children: ReactNode
}

export function GridFiltersPopover({
  categories,
  filterActions,
  children,
}: GridFiltersPopoverProps) {
  const { filters, setCategories, setStatus, setDateRange, clearFilters } =
    filterActions

  const selectedCategories = filters.categories ?? []
  const selectedStatuses = filters.status ?? []

  const handleCategoryToggle = (category: string, checked: boolean) => {
    if (checked) {
      setCategories([...selectedCategories, category])
    } else {
      setCategories(selectedCategories.filter((c) => c !== category))
    }
  }

  const handleStatusToggle = (status: StatusOption, checked: boolean) => {
    if (checked) {
      setStatus([...selectedStatuses, status])
    } else {
      setStatus(selectedStatuses.filter((s) => s !== status))
    }
  }

  const categoryLabel =
    selectedCategories.length === 0
      ? 'All panels'
      : selectedCategories.length === 1
        ? selectedCategories[0]
        : `${selectedCategories.length} panels`

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="p-4 pb-2">
          <h4 className="text-sm font-semibold">Filters</h4>
        </div>
        <div className="space-y-4 p-4 pt-0">
          {/* Categories dropdown */}
          {categories.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Panel
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between text-xs font-normal"
                  >
                    <span className="truncate">{categoryLabel}</span>
                    <ChevronDown className="ml-1 size-3.5 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="max-h-64 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
                  align="start"
                >
                  {categories.map((category) => (
                    <DropdownMenuCheckboxItem
                      key={category}
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={(checked) =>
                        handleCategoryToggle(category, checked)
                      }
                      onSelect={(e) => e.preventDefault()}
                    >
                      {category}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <Separator />

          {/* Status section */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Status
            </Label>
            <div className="space-y-1.5">
              {STATUS_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={selectedStatuses.includes(option.value)}
                    onCheckedChange={(checked) =>
                      handleStatusToggle(option.value, checked === true)
                    }
                  />
                  <span
                    className={`size-2.5 rounded-full ${option.colorClass}`}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          {/* Date range section */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Date Range
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="dateFrom" className="text-xs">
                  From
                </Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={filters.dateFrom ?? ''}
                  onChange={(e) =>
                    setDateRange(e.target.value || undefined, filters.dateTo)
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dateTo" className="text-xs">
                  To
                </Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={filters.dateTo ?? ''}
                  onChange={(e) =>
                    setDateRange(filters.dateFrom, e.target.value || undefined)
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Clear all */}
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={clearFilters}
          >
            Clear all filters
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
