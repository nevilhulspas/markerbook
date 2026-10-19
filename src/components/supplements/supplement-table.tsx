'use client'

import { startTransition, useCallback, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Download, Pencil, Plus } from 'lucide-react'

import type { SupplementWithIntakes } from '@/lib/database.types'
import {
  matchesSupplementMode,
  type SupplementMode,
} from '@/lib/supplements/mode'
import { getSupplements } from '@/actions/supplements'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SupplementEditor } from '@/components/supplements/supplement-editor'
import { GroupedSupplementList } from '@/components/supplements/grouped-supplement-list'
import { deriveFrequency } from '@/lib/supplements/intake'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type SortKey = 'name' | 'start_date' | 'end_date'
type SortDir = 'asc' | 'desc'

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

interface SupplementTableProps {
  supplements: SupplementWithIntakes[]
  mode: SupplementMode
}

export function SupplementTable({
  supplements: initialSupplements,
  mode,
}: SupplementTableProps) {
  const [rows, setRows] = useState<SupplementWithIntakes[]>(initialSupplements)
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('start_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingSupplement, setEditingSupplement] =
    useState<SupplementWithIntakes | null>(null)

  const refresh = useCallback(() => {
    setEditorOpen(false)
    setEditingSupplement(null)
    startTransition(async () => {
      const result = await getSupplements()
      if (result.data) {
        setRows(result.data.filter((s) => matchesSupplementMode(s, mode)))
      }
    })
  }, [mode])

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const filtered = q
      ? rows.filter((s) => s.name.toLowerCase().includes(q))
      : rows
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sortKey === 'start_date') {
        const cmp = a.start_date.localeCompare(b.start_date)
        if (cmp !== 0) return cmp * dir
        return a.name.localeCompare(b.name)
      }
      if (sortKey === 'end_date') {
        const av = a.end_date ?? ''
        const bv = b.end_date ?? ''
        const cmp = av.localeCompare(bv)
        if (cmp !== 0) return cmp * dir
        return a.name.localeCompare(b.name)
      }
      return a.name.localeCompare(b.name) * dir
    })
  }, [rows, filter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function handleAdd() {
    setEditingSupplement(null)
    setEditorOpen(true)
  }

  function handleEdit(supplement: SupplementWithIntakes) {
    setEditingSupplement(supplement)
    setEditorOpen(true)
  }

  const colSpan = mode === 'stopped' ? 6 : 5

  // Active and Upcoming are always grouped by intake time — that is the view
  // this page is for, so there is no toggle. Stopped keeps the flat table,
  // where the Stopped date is what you scan for, not a schedule.
  const isSchedule = mode === 'active' || mode === 'upcoming'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search supplements…"
          aria-label="Search supplements"
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          {isSchedule && (
            <Button size="sm" asChild>
              <a href={`/api/supplements/pdf?mode=${mode}`}>
                <Download className="size-4" />
                Download PDF
              </a>
            </Button>
          )}
          {mode === 'active' && (
            <Button size="sm" onClick={handleAdd}>
              <Plus className="size-4" />
              Add supplement
            </Button>
          )}
        </div>
      </div>
      {isSchedule ? (
        <GroupedSupplementList
          supplements={visible}
          mode={mode}
          onEdit={handleEdit}
        />
      ) : (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortHeader
                  label="Name"
                  active={sortKey === 'name'}
                  dir={sortDir}
                  onClick={() => toggleSort('name')}
                />
              </TableHead>
              <TableHead>Dose</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>
                <SortHeader
                  // Only Stopped reaches this table now, so the start date is
                  // always in the past.
                  label="Started"
                  active={sortKey === 'start_date'}
                  dir={sortDir}
                  onClick={() => toggleSort('start_date')}
                />
              </TableHead>
              {mode === 'stopped' && (
                <TableHead>
                  <SortHeader
                    label="Stopped"
                    active={sortKey === 'end_date'}
                    dir={sortDir}
                    onClick={() => toggleSort('end_date')}
                  />
                </TableHead>
              )}
              <TableHead className="w-1 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="text-center text-sm text-muted-foreground"
                >
                  No supplements
                </TableCell>
              </TableRow>
            ) : (
              visible.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.dose ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {deriveFrequency(s.intakes, s.frequency, s.end_date) ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.start_date}
                  </TableCell>
                  {mode === 'stopped' && (
                    <TableCell className="text-muted-foreground">
                      {s.end_date ?? '—'}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(s)}
                      aria-label={`Edit ${s.name}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      )}

      <SupplementEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        supplement={editingSupplement}
        onSaved={refresh}
        onDeleted={refresh}
      />
    </div>
  )
}
