'use client'

import { Fragment, startTransition, useCallback, useMemo, useState } from 'react'
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { createSupplement } from '@/actions/supplements'
import {
  deleteWishlistItem,
  deleteWishlistSource,
  getWishlist,
} from '@/actions/wishlist'
import type {
  WishlistItemWithSources,
  WishlistSource,
} from '@/lib/database.types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { WishlistItemEditor } from './wishlist-item-editor'
import { SourceEditor } from './source-editor'
import { appTodayISO } from '@/lib/dates/today'

type SortKey = 'name' | 'priority'
type SortDir = 'asc' | 'desc'

const PRIORITY_STYLE: Record<string, string> = {
  high: 'bg-red-500/15 text-red-600',
  medium: 'bg-amber-500/15 text-amber-600',
  low: 'bg-slate-500/15 text-slate-500',
}

// high → medium → low → none
const PRIORITY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

function priorityRank(priority: string | null): number {
  return priority ? (PRIORITY_RANK[priority] ?? 3) : 3
}

function minPrice(sources: WishlistSource[]): WishlistSource | null {
  let best: WishlistSource | null = null
  for (const s of sources) {
    if (s.price == null) continue
    if (best == null || s.price < (best.price ?? Number.POSITIVE_INFINITY)) {
      best = s
    }
  }
  return best
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center font-medium"
    >
      {label}
      {active &&
        (dir === 'asc' ? (
          <ChevronUp className="ml-1 size-3" />
        ) : (
          <ChevronDown className="ml-1 size-3" />
        ))}
    </button>
  )
}

const COL_SPAN = 5

export function WishlistTable({
  initialItems,
}: {
  initialItems: WishlistItemWithSources[]
}) {
  const [items, setItems] = useState(initialItems)
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('priority')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [movingId, setMovingId] = useState<string | null>(null)

  const [itemEditorOpen, setItemEditorOpen] = useState(false)
  const [editingItem, setEditingItem] =
    useState<WishlistItemWithSources | null>(null)

  const [sourceEditorOpen, setSourceEditorOpen] = useState(false)
  const [sourceItemId, setSourceItemId] = useState<string | null>(null)
  const [editingSource, setEditingSource] = useState<WishlistSource | null>(
    null
  )

  const refresh = useCallback(() => {
    setItemEditorOpen(false)
    setSourceEditorOpen(false)
    startTransition(async () => {
      const res = await getWishlist()
      if (res.data) setItems(res.data)
    })
  }, [])

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const filtered = q
      ? items.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            item.sources.some((s) => s.brand?.toLowerCase().includes(q))
        )
      : items
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sortKey === 'priority') {
        const diff = priorityRank(a.priority) - priorityRank(b.priority)
        if (diff !== 0) return diff * dir
        return a.name.localeCompare(b.name)
      }
      return a.name.localeCompare(b.name) * dir
    })
  }, [items, filter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleAddItem() {
    setEditingItem(null)
    setItemEditorOpen(true)
  }

  function handleEditItem(item: WishlistItemWithSources) {
    setEditingItem(item)
    setItemEditorOpen(true)
  }

  function handleAddSource(itemId: string) {
    setSourceItemId(itemId)
    setEditingSource(null)
    setSourceEditorOpen(true)
  }

  function handleEditSource(itemId: string, source: WishlistSource) {
    setSourceItemId(itemId)
    setEditingSource(source)
    setSourceEditorOpen(true)
  }

  async function handleAddToStack(item: WishlistItemWithSources) {
    setMovingId(item.id)
    try {
      const today = appTodayISO()
      const res = await createSupplement({ name: item.name, start_date: today })
      if (!res.success) {
        toast.error(res.error ?? 'Failed to add to stack')
        return
      }
      const delRes = await deleteWishlistItem(item.id)
      if (!delRes.success) {
        toast.error(delRes.error ?? 'Supplement added but failed to remove from wishlist')
        refresh()
        return
      }
      toast.success(`Moved "${item.name}" to your active stack`)
      refresh()
    } finally {
      setMovingId(null)
    }
  }

  async function handleDeleteItem(item: WishlistItemWithSources) {
    const res = await deleteWishlistItem(item.id)
    if (res.success) {
      toast.success('Removed from wishlist')
      refresh()
    } else {
      toast.error(res.error ?? 'Failed to remove')
    }
  }

  async function handleDeleteSource(id: string) {
    const res = await deleteWishlistSource(id)
    if (res.success) refresh()
    else toast.error(res.error ?? 'Failed to remove source')
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search supplements…"
          aria-label="Search wishlist"
          className="max-w-sm"
        />
        <Button size="sm" onClick={handleAddItem}>
          <Plus className="size-4" />
          Add item
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1" />
              <TableHead>
                <SortHeader
                  label="Name"
                  active={sortKey === 'name'}
                  dir={sortDir}
                  onClick={() => toggleSort('name')}
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  label="Priority"
                  active={sortKey === 'priority'}
                  dir={sortDir}
                  onClick={() => toggleSort('priority')}
                />
              </TableHead>
              <TableHead>Sources</TableHead>
              <TableHead className="w-1 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={COL_SPAN}
                  className="text-center text-sm text-muted-foreground"
                >
                  Nothing on your wishlist yet.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((item) => {
                const isOpen = expanded.has(item.id)
                const cheapest = minPrice(item.sources)
                return (
                  <Fragment key={item.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => toggleExpanded(item.id)}
                    >
                      <TableCell>
                        <button
                          type="button"
                          className="flex items-center text-muted-foreground"
                          aria-label={isOpen ? 'Collapse' : 'Expand'}
                          aria-expanded={isOpen}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpanded(item.id)
                          }}
                        >
                          {isOpen ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        {item.priority ? (
                          <Badge
                            variant="secondary"
                            className={PRIORITY_STYLE[item.priority]}
                          >
                            {item.priority}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.sources.length}{' '}
                        {item.sources.length === 1 ? 'source' : 'sources'}
                        {cheapest?.price != null && (
                          <> · from {cheapest.price} {cheapest.currency ?? 'EUR'}</>
                        )}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleAddToStack(item)}
                            disabled={movingId === item.id}
                            aria-label={`Add ${item.name} to stack`}
                            title="Add to active stack"
                          >
                            {movingId === item.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <ArrowRightLeft className="size-3.5" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditItem(item)}
                            aria-label={`Edit ${item.name}`}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteItem(item)}
                            aria-label={`Delete ${item.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={COL_SPAN}>
                          <div className="space-y-2 px-2 py-1">
                            {item.notes && (
                              <p className="text-sm text-muted-foreground">
                                {item.notes}
                              </p>
                            )}
                            {item.sources.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No sources yet.
                              </p>
                            ) : (
                              <ul className="space-y-1">
                                {item.sources.map((s) => (
                                  <li
                                    key={s.id}
                                    className="flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-sm"
                                  >
                                    <span className="font-medium">
                                      {s.brand ?? 'Source'}
                                    </span>
                                    {s.price != null && (
                                      <span className="text-muted-foreground">
                                        {s.price} {s.currency ?? 'EUR'}
                                      </span>
                                    )}
                                    {s.url && (
                                      <a
                                        href={s.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-primary hover:underline"
                                        aria-label="Open source"
                                      >
                                        <ExternalLink className="size-3.5" />
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      className="ml-auto text-muted-foreground hover:text-foreground"
                                      onClick={() => handleEditSource(item.id, s)}
                                      aria-label="Edit source"
                                    >
                                      <Pencil className="size-3" />
                                    </button>
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-destructive"
                                      onClick={() => handleDeleteSource(s.id)}
                                      aria-label="Delete source"
                                    >
                                      <Trash2 className="size-3" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-muted-foreground"
                              onClick={() => handleAddSource(item.id)}
                            >
                              <Plus className="size-3.5" /> Add source
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <WishlistItemEditor
        key={editingItem?.id ?? 'new-item'}
        open={itemEditorOpen}
        onOpenChange={setItemEditorOpen}
        item={editingItem}
        onSaved={refresh}
      />
      {sourceItemId && (
        <SourceEditor
          key={editingSource?.id ?? `new-source-${sourceItemId}`}
          open={sourceEditorOpen}
          onOpenChange={setSourceEditorOpen}
          itemId={sourceItemId}
          source={editingSource}
          onSaved={refresh}
        />
      )}
    </div>
  )
}
