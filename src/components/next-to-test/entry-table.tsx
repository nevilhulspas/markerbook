'use client'

// Client wrapper around the /next-to-test table that owns row-
// selection state and feeds the BulkActionsBar. Keeps the page server
// component lean — all data fetching + filtering + sorting happens server-
// side and is passed down as plain props.
//
// Header sort affordances and category sub-headers live here too because
// the checkbox column needs to participate in the same grid layout.

import { useState, useMemo, useEffect, Fragment } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronRight } from 'lucide-react'

import type { LabOptionForBiomarker } from '@/lib/next-to-test/lab-options'
import type { NextToTestList, NextToTestType } from '@/lib/database.types'
import { Checkbox } from '@/components/ui/checkbox'
import { SourceCellPicker } from '@/components/next-to-test/source-cell-picker'
import { EntryRowActions } from '@/components/next-to-test/entry-row-actions'
import {
  SortableHeaderLink,
  type SortKey,
  type SortOrder,
} from '@/components/next-to-test/table-controls'
import { BulkActionsBar } from '@/components/next-to-test/bulk-actions-bar'

// Mirror of the page's local EntryWithResolved shape — kept structural so
// the page doesn't have to export an internal type just to call this
// component.
export interface EntryRow {
  id: string
  list_id: string
  test_type: NextToTestType
  name: string
  source_label: string
  canonical_biomarker_id: string | null
  current_lab_test_id: string | null
  note: string | null
  due_date: string | null
  status: 'pending' | 'done'
  created_at: string
  lab_options: LabOptionForBiomarker[]
}

export interface EntryGroup {
  group: string
  label: string
  rows: EntryRow[]
}

interface Props {
  groupedRows: EntryGroup[]
  lists: NextToTestList[]
  currentListId: string
  today: string
  sort: SortKey
  order: SortOrder
  headerParamsString: string
}

// LocalStorage key for the per-user saved sort preference. The
// page defaults to name/asc; this key records what the user last actively
// chose (via column-header clicks) so a return visit restores that view
// instead of always snapping back to A→Z.
const SORT_STORAGE_KEY = 'next-to-test:sort'

function readSavedSort(): { sort: string; order: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SORT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { sort?: unknown; order?: unknown }
    if (typeof parsed.sort !== 'string' || typeof parsed.order !== 'string') {
      return null
    }
    return { sort: parsed.sort, order: parsed.order }
  } catch {
    return null
  }
}

function writeSavedSort(sort: string, order: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      SORT_STORAGE_KEY,
      JSON.stringify({ sort, order })
    )
  } catch {
    // localStorage unavailable / quota — silently no-op.
  }
}

// LocalStorage key for the per-user collapsed-group preference.
// Scoped by list so different lists remember independently — collapsing
// "Blood markers" on the Checkup list shouldn't hide it on the full panel.
const COLLAPSED_GROUPS_STORAGE_KEY = 'next-to-test:collapsed-groups'

function readCollapsed(listId: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(COLLAPSED_GROUPS_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as Record<string, string[]>
    return new Set(parsed[listId] ?? [])
  } catch {
    return new Set()
  }
}

function writeCollapsed(listId: string, groups: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(COLLAPSED_GROUPS_STORAGE_KEY)
    const parsed = (raw ? JSON.parse(raw) : {}) as Record<string, string[]>
    if (groups.size === 0) {
      delete parsed[listId]
    } else {
      parsed[listId] = Array.from(groups)
    }
    window.localStorage.setItem(
      COLLAPSED_GROUPS_STORAGE_KEY,
      JSON.stringify(parsed)
    )
  } catch {
    // localStorage unavailable / quota — silently no-op rather than fail
    // the click that triggered the write.
  }
}

export function EntryTable({
  groupedRows,
  lists,
  currentListId,
  today,
  sort,
  order,
  headerParamsString,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Sort persistence.
  // - Whenever the URL has an explicit ?sort= (i.e. the user clicked a
  //   column header — SortableHeaderLink now always sets sort + order),
  //   mirror it to localStorage.
  // - On mount, if the URL has NO sort param, read localStorage and
  //   redirect once to apply the saved preference. Avoids a loop because
  //   the post-redirect URL has sort/order set, so we hit the save branch
  //   on the next render instead.
  useEffect(() => {
    const urlSort = params.get('sort')
    const urlOrder = params.get('order')
    if (urlSort && urlOrder) {
      writeSavedSort(urlSort, urlOrder)
      return
    }
    const saved = readSavedSort()
    if (!saved) return
    // Don't redirect to the default — it's already what we render.
    if (saved.sort === 'name' && saved.order === 'asc') return
    const next = new URLSearchParams(params.toString())
    next.set('sort', saved.sort)
    next.set('order', saved.order)
    router.replace(`${pathname}?${next.toString()}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  // Collapsed category groups, persisted to localStorage so a
  // refresh (including the `router.refresh()` after every bulk action)
  // keeps the user's collapse state. Starts empty on SSR to avoid hydration
  // mismatch — useEffect hydrates from storage post-mount. The "set state
  // in effect" rule is intentionally suppressed here because syncing from
  // an external store (localStorage) on mount is exactly the case this
  // pattern is for; useSyncExternalStore would be overkill for a per-list
  // preference that only changes via the click handler below.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set()
  )
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsedGroups(readCollapsed(currentListId))
  }, [currentListId])

  function toggleGroup(group: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      writeCollapsed(currentListId, next)
      return next
    })
  }

  // Memoize the flat id list of *visible* rows so the header "Select all"
  // checkbox truly means "select what I can see". Rows hidden under a
  // collapsed category group are excluded — operating on rows the user
  // can't see would be a surprise bulk-delete waiting to happen. The
  // per-group checkbox on the sub-header still selects its own rows
  // regardless of collapse state, so the user can pick up hidden rows
  // intentionally if they want.
  const allIds = useMemo(
    () =>
      groupedRows
        .filter((g) => !collapsedGroups.has(g.group))
        .flatMap((g) => g.rows.map((r) => r.id)),
    [groupedRows, collapsedGroups]
  )

  // checked: true | false | 'indeterminate' for the header / group
  // checkboxes — Radix Checkbox understands all three.
  function tristate(ids: string[]): boolean | 'indeterminate' {
    if (ids.length === 0) return false
    const hit = ids.filter((id) => selected.has(id)).length
    if (hit === 0) return false
    if (hit === ids.length) return true
    return 'indeterminate'
  }

  function toggleOne(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleMany(ids: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) ids.forEach((id) => next.add(id))
      else ids.forEach((id) => next.delete(id))
      return next
    })
  }

  function clearSelection() {
    setSelected(new Set())
  }

  const selectedIds = useMemo(() => Array.from(selected), [selected])
  const allChecked = tristate(allIds)

  return (
    <div className="space-y-3">
      {selectedIds.length > 0 && (
        <BulkActionsBar
          selectedIds={selectedIds}
          lists={lists}
          currentListId={currentListId}
          onClear={clearSelection}
        />
      )}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="w-1 px-3 py-2">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={(v) =>
                    toggleMany(allIds, v === true)
                  }
                  aria-label="Select all"
                />
              </th>
              <th className="px-3 py-2 font-medium">
                <SortableHeaderLink
                  label="Name"
                  sortKey="name"
                  currentSort={sort}
                  currentOrder={order}
                  searchParamsString={headerParamsString}
                />
              </th>
              <th className="px-3 py-2 font-medium">
                <SortableHeaderLink
                  label="Source"
                  sortKey="source"
                  currentSort={sort}
                  currentOrder={order}
                  searchParamsString={headerParamsString}
                />
              </th>
              <th className="px-3 py-2 font-medium">Note</th>
              <th className="px-3 py-2 font-medium">
                <SortableHeaderLink
                  label="Due"
                  sortKey="due"
                  currentSort={sort}
                  currentOrder={order}
                  searchParamsString={headerParamsString}
                />
              </th>
              <th className="px-3 py-2 font-medium">
                <SortableHeaderLink
                  label="Status"
                  sortKey="status"
                  currentSort={sort}
                  currentOrder={order}
                  searchParamsString={headerParamsString}
                />
              </th>
              <th className="w-1 px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groupedRows.map((g) => {
              const groupIds = g.rows.map((r) => r.id)
              const groupChecked = tristate(groupIds)
              const isCollapsed = collapsedGroups.has(g.group)
              return (
                <Fragment key={g.group}>
                  {/* Category sub-header row. Clickable to collapse/expand
                      the whole group; the checkbox cell stays separate so
                      a click on the checkbox doesn't also toggle collapse.
                      The label cell is a <button> wrapping for keyboard
                      accessibility and aria-expanded state. */}
                  <tr className="bg-muted/20 border-t">
                    <th
                      className="w-1 px-3 py-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={groupChecked}
                        onCheckedChange={(v) =>
                          toggleMany(groupIds, v === true)
                        }
                        aria-label={`Select all ${g.label}`}
                      />
                    </th>
                    <th
                      colSpan={6}
                      scope="rowgroup"
                      className="px-0 py-0"
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroup(g.group)}
                        aria-expanded={!isCollapsed}
                        aria-controls={`group-${g.group}`}
                        className="text-muted-foreground/80 hover:bg-muted/30 hover:text-foreground flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wide transition-colors"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="size-3" />
                        ) : (
                          <ChevronDown className="size-3" />
                        )}
                        <span>{g.label}</span>
                        <span className="text-muted-foreground/50 font-normal normal-case tracking-normal">
                          ({g.rows.length})
                        </span>
                      </button>
                    </th>
                  </tr>
                  {!isCollapsed &&
                    g.rows.map((e) => {
                    const overdue =
                      e.status === 'pending' &&
                      !!e.due_date &&
                      e.due_date < today
                    const isBlood =
                      e.test_type === 'blood_biomarker' ||
                      e.test_type === 'blood_lab_test'
                    const isChecked = selected.has(e.id)
                    return (
                      <tr
                        key={e.id}
                        // Tint the row when selected so the user can see what
                        // they're about to bulk-operate on at a glance.
                        className={`border-t ${
                          overdue ? 'bg-destructive/5' : ''
                        } ${isChecked ? 'bg-accent/30' : ''}`}
                      >
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(v) =>
                              toggleOne(e.id, v === true)
                            }
                            aria-label={`Select ${e.name}`}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium">{e.name}</td>
                        <td className="px-3 py-2">
                          {isBlood ? (
                            <SourceCellPicker
                              entryId={e.id}
                              kind={
                                e.test_type === 'blood_biomarker'
                                  ? 'biomarker'
                                  : 'lab_test'
                              }
                              currentLabTestId={e.current_lab_test_id}
                              biomarkerId={e.canonical_biomarker_id}
                              options={e.lab_options}
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {e.note ?? '—'}
                        </td>
                        <td
                          className={`px-3 py-2 ${
                            overdue
                              ? 'text-destructive font-medium'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {e.due_date ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {e.status}
                        </td>
                        <td className="px-3 py-2">
                          <EntryRowActions
                            entryId={e.id}
                            status={e.status}
                            note={e.note}
                            dueDate={e.due_date}
                            currentListId={e.list_id}
                            lists={lists}
                          />
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
    </div>
  )
}
