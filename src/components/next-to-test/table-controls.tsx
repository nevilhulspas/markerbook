'use client'

// AUT-854 follow-up: dropdown filters for /next-to-test.
//
// State lives in the URL (?status=…&source=…) so views are bookmarkable
// and `router.refresh()` after pin/unpin preserves the user's selection.
//
// - StatusFilterDropdown: shadcn Select for the {Pending, Done, All}
//   tri-state. Single-select; default 'pending' clears the URL param.
// - SourceFilterDropdown: shadcn DropdownMenu with CheckboxItems for
//   multi-source filtering. Trigger summarises the current selection
//   ("All sources" / single label / "N sources").
//
// Column-header sorting (no separate Sort dropdown any more) is rendered
// by SortableHeaderLink — a server-friendly anchor whose href encodes the
// next sort/order combination on click. Lives here so the filter and
// sort controls share their URL-mutation helpers.

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type SortKey = 'created' | 'name' | 'due' | 'source' | 'status'
export type SortOrder = 'asc' | 'desc'

function useUrlUpdate() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  return useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString())
      mutate(next)
      // Drop default-valued non-sort params so URLs stay short. Sort + order
      // intentionally stay explicit so the persistence layer can distinguish
      // a deliberate user click from a fresh visit (AUT-864).
      if (next.get('status') === 'pending') next.delete('status')
      const qs = next.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [router, pathname, params]
  )
}

// -----------------------------------------------------------------------
// Status: Pending / Done / All — single-select
// -----------------------------------------------------------------------

const STATUS_OPTS: Array<{
  value: 'pending' | 'done' | 'all'
  label: string
}> = [
  { value: 'pending', label: 'Pending' },
  { value: 'done', label: 'Done' },
  { value: 'all', label: 'All' },
]

export function StatusFilterDropdown({
  status,
}: {
  status: 'pending' | 'done' | 'all'
}) {
  const update = useUrlUpdate()
  return (
    <Select
      value={status}
      onValueChange={(v) =>
        update((p) => {
          // 'pending' is the default and gets stripped in useUrlUpdate.
          if (v === 'pending') p.delete('status')
          else p.set('status', v)
        })
      }
    >
      <SelectTrigger size="sm" className="h-8 gap-1.5 px-2 text-xs">
        <span className="text-muted-foreground">Status:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTS.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// -----------------------------------------------------------------------
// Source: multi-select via DropdownMenu + CheckboxItems
// -----------------------------------------------------------------------

export function SourceFilterDropdown({
  sources,
  active,
}: {
  // Distinct source labels present in the current (status-filtered) entry
  // set. "Any lab" appears whenever at least one biomarker row exists.
  sources: string[]
  // Currently-checked labels. Empty = no filter (show everything).
  active: string[]
}) {
  const update = useUrlUpdate()
  if (sources.length <= 1) {
    // No point showing the dropdown when there's only one possible source.
    return null
  }
  const toggle = (s: string) =>
    update((p) => {
      const next = active.includes(s)
        ? active.filter((a) => a !== s)
        : [...active, s]
      if (next.length === 0) p.delete('source')
      else p.set('source', next.join(','))
    })

  // Trigger label: nothing checked → "All sources" (no filter applied);
  // 1 → that source; N → "N sources".
  const triggerLabel =
    active.length === 0
      ? 'All sources'
      : active.length === 1
        ? active[0]
        : `${active.length} sources`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 px-2 text-xs font-normal"
        >
          <span className="text-muted-foreground">Source:</span>
          <span className="truncate max-w-[10rem]">{triggerLabel}</span>
          <ChevronsUpDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {sources.map((s) => (
          <DropdownMenuCheckboxItem
            key={s}
            checked={active.includes(s)}
            onCheckedChange={() => toggle(s)}
            onSelect={(e) => e.preventDefault()} // keep the menu open on tick
            className="text-sm"
          >
            {s}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// -----------------------------------------------------------------------
// Category (test_type) filter — multi-select via DropdownMenu
// -----------------------------------------------------------------------

export function CategoryFilterDropdown({
  categories,
  active,
}: {
  // Each entry: { value, label } where `value` is the underlying
  // category-group key (matches groupOf() in page.tsx) and `label` is the
  // human-readable text shown in the menu and the trigger summary.
  categories: Array<{ value: string; label: string }>
  active: string[]
}) {
  const update = useUrlUpdate()
  if (categories.length <= 1) return null
  const toggle = (v: string) =>
    update((p) => {
      const next = active.includes(v)
        ? active.filter((a) => a !== v)
        : [...active, v]
      if (next.length === 0) p.delete('category')
      else p.set('category', next.join(','))
    })

  const triggerLabel =
    active.length === 0
      ? 'All categories'
      : active.length === 1
        ? (categories.find((c) => c.value === active[0])?.label ?? active[0])
        : `${active.length} categories`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 px-2 text-xs font-normal"
        >
          <span className="text-muted-foreground">Category:</span>
          <span className="truncate max-w-[10rem]">{triggerLabel}</span>
          <ChevronsUpDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {categories.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.value}
            checked={active.includes(c.value)}
            onCheckedChange={() => toggle(c.value)}
            onSelect={(e) => e.preventDefault()}
            className="text-sm"
          >
            {c.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// -----------------------------------------------------------------------
// SortableHeaderLink: click-to-sort column header
// -----------------------------------------------------------------------

/**
 * Anchor wrapping a column-header label. Renders the next sort URL in the
 * `href` (no client onClick), so the th can be a normal Link — server-rendered
 * for free and progressively enhanced. Active column shows an up/down arrow.
 *
 * Click rules:
 *   - first click on an inactive column → sort by that column ascending;
 *   - second click on the same column → flip to descending;
 *   - third click → flip back to ascending (no "off" state to avoid losing
 *     the user's last meaningful intent).
 *
 * Page-level default is `sort=created&order=desc`, which is represented in
 * the URL as the empty query — both keys are stripped when they match the
 * default so URLs stay short.
 */
export function SortableHeaderLink({
  label,
  sortKey,
  currentSort,
  currentOrder,
  searchParamsString,
}: {
  label: string
  sortKey: SortKey
  currentSort: SortKey
  currentOrder: SortOrder
  // Raw `?key=val&…` string (without the leading `?`) of the current URL,
  // so the link can mutate just sort/order while preserving list, status,
  // source, etc.
  searchParamsString: string
}) {
  const isActive = currentSort === sortKey
  const nextOrder: SortOrder = isActive
    ? currentOrder === 'asc'
      ? 'desc'
      : 'asc'
    : 'asc'

  // Always set sort + order explicitly so the URL records the user's choice
  // even when it matches the page default (name asc). The localStorage
  // persistence in EntryTable keys off "URL has sort/order" — stripping
  // here would make a click on the default-sort column indistinguishable
  // from a fresh visit and cause a restore loop. (AUT-864)
  const next = new URLSearchParams(searchParamsString)
  next.set('sort', sortKey)
  next.set('order', nextOrder)
  const href = `/next-to-test?${next.toString()}`

  return (
    <Link
      href={href}
      scroll={false}
      className="-mx-2 -my-1 inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-accent/50"
      aria-sort={
        isActive
          ? currentOrder === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none'
      }
    >
      <span>{label}</span>
      {isActive ? (
        currentOrder === 'asc' ? (
          <ArrowUp className="size-3" />
        ) : (
          <ArrowDown className="size-3" />
        )
      ) : (
        <ChevronsUpDown className="text-muted-foreground/40 size-3" />
      )}
    </Link>
  )
}
