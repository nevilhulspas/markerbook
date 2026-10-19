'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { FileDown, FileText, SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  ALL_COLUMNS,
  COLUMN_LABELS,
  normalizeFormat,
  type ListColumn,
  type ListFormat,
  type ListSort,
} from '@/lib/export/list-format'
import type { BuildListsResult, ExportList } from '@/lib/labs/lab-test-tools'

// The export module pulls in jsPDF; load it when a download button is clicked.
const loadListExport = () => import('@/lib/export/export-lab-list')

const SORTS: { key: ListSort; label: string }[] = [
  { key: 'default', label: 'As built' },
  { key: 'name', label: 'Name' },
  { key: 'cost_asc', label: 'Cost ↑' },
  { key: 'cost_desc', label: 'Cost ↓' },
]

function LabTestListCard({ list, initialFormat }: { list: ExportList; initialFormat: ListFormat }) {
  const available = list.items.filter((i) => i.found).length
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<ListFormat>(initialFormat)
  const [exporting, setExporting] = useState(false)

  // Loads the export module on click; one export at a time, and a failed load
  // (e.g. a stale tab after a deploy) is reported instead of doing nothing.
  async function runExport(kind: 'pdf' | 'txt') {
    if (exporting) return
    setExporting(true)
    try {
      const m = await loadListExport()
      if (kind === 'pdf') m.exportLabListAsPdf(list, format)
      else m.exportLabListAsTxt(list, format)
    } catch {
      toast.error('Could not create the file. Please reload the page and try again.')
    } finally {
      setExporting(false)
    }
  }

  function toggleColumn(c: ListColumn) {
    setFormat((f) => ({
      ...f,
      columns: f.columns.includes(c)
        ? f.columns.filter((x) => x !== c)
        : ALL_COLUMNS.filter((x) => x === c || f.columns.includes(x)),
    }))
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Tests to request — {list.labName}</p>
          <p className="text-xs text-muted-foreground">
            {list.items.length} test{list.items.length === 1 ? '' : 's'}
            {available !== list.items.length && ` · ${available} available`}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button
            size="sm"
            variant={open ? 'secondary' : 'ghost'}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="Customize"
          >
            <SlidersHorizontal className="size-3.5" />
          </Button>
          <Button size="sm" variant="outline" disabled={exporting} onClick={() => void runExport('pdf')}>
            <FileDown className="mr-1 size-3.5" />
            PDF
          </Button>
          <Button size="sm" variant="outline" disabled={exporting} onClick={() => void runExport('txt')}>
            <FileText className="mr-1 size-3.5" />
            TXT
          </Button>
        </div>
      </div>

      {open && (
        <div className="space-y-2 border-t px-3 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-14 shrink-0 text-muted-foreground">Columns</span>
            {ALL_COLUMNS.map((c) => (
              <Button
                key={c}
                size="sm"
                variant={format.columns.includes(c) ? 'default' : 'outline'}
                className="h-6 px-2"
                onClick={() => toggleColumn(c)}
              >
                {COLUMN_LABELS[c]}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-14 shrink-0 text-muted-foreground">Sort</span>
            {SORTS.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={format.sort === s.key ? 'default' : 'outline'}
                className="h-6 px-2"
                onClick={() => setFormat((f) => ({ ...f, sort: s.key }))}
              >
                {s.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-14 shrink-0 text-muted-foreground">Filter</span>
            <Button
              size="sm"
              variant={format.hideUnavailable ? 'default' : 'outline'}
              className="h-6 px-2"
              onClick={() => setFormat((f) => ({ ...f, hideUnavailable: !f.hideUnavailable }))}
            >
              {format.hideUnavailable ? 'Unavailable hidden' : 'Hide unavailable'}
            </Button>
          </div>
        </div>
      )}

      {!list.labFound && (
        <p className="px-3 pb-2 text-xs text-amber-600">
          This lab wasn’t found in the directory — details are unverified.
        </p>
      )}
    </div>
  )
}

/** Render a `build_lab_test_lists` tool result as one downloadable card per lab. */
export function LabTestLists({ result }: { result: BuildListsResult }) {
  if (!result?.lists?.length) return null
  const initialFormat = normalizeFormat(result.format)
  return (
    <div className="space-y-3">
      {result.title && <p className="text-sm font-medium">{result.title}</p>}
      {result.lists.map((list, i) => (
        <LabTestListCard key={`${list.labName}-${i}`} list={list} initialFormat={initialFormat} />
      ))}
    </div>
  )
}
