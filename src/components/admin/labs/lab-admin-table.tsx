'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

import type { Lab } from '@/lib/database.types'
import type { AdminLab } from '@/actions/admin/labs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LabTestEditor } from '@/components/admin/labs/lab-test-editor'
import { AddLabDialog, EditLabDialog } from '@/components/admin/labs/lab-form'
import { LabTableRow } from '@/components/admin/labs/lab-table-row'
import { ScrapeLogsDialog } from '@/components/admin/labs/scrape-logs-dialog'
import { useScrapeJobPolling } from '@/components/admin/labs/use-scrape-job-polling'

interface BiomarkerOption {
  id: string
  name: string
  short_name: string | null
}

interface LabAdminTableProps {
  labs: AdminLab[]
  biomarkers: BiomarkerOption[]
}

type SortKey = 'name' | 'status'
type SortDir = 'asc' | 'desc'

export function LabAdminTable({ labs, biomarkers }: LabAdminTableProps) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [addOpen, setAddOpen] = useState(false)
  const [editingLab, setEditingLab] = useState<Lab | null>(null)
  const [managingLab, setManagingLab] = useState<Lab | null>(null)
  const [logsLabId, setLogsLabId] = useState<string | null>(null)

  const labNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const lab of labs) map.set(lab.id, lab.name)
    return map
  }, [labs])

  const { jobs, startScrape } = useScrapeJobPolling(labNameById)

  const visibleLabs = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? labs.filter((lab) =>
          [lab.name, lab.city ?? '', lab.country ?? '']
            .join(' ')
            .toLowerCase()
            .includes(q)
        )
      : labs
    const sorted = [...filtered].sort((a, b) => {
      const av = (sortKey === 'name' ? a.name : a.status).toLowerCase()
      const bv = (sortKey === 'name' ? b.name : b.status).toLowerCase()
      const cmp = av.localeCompare(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [labs, query, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function renderSortIndicator(key: SortKey) {
    if (key !== sortKey) return null
    return sortDir === 'asc' ? (
      <ChevronUp className="size-3.5" />
    ) : (
      <ChevronDown className="size-3.5" />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter labs…"
          className="max-w-xs"
          aria-label="Filter labs"
        />
        <Button onClick={() => setAddOpen(true)}>Add lab</Button>
      </div>

      {labs.length === 0 ? (
        <p className="text-muted-foreground">No labs yet.</p>
      ) : visibleLabs.length === 0 ? (
        <p className="text-muted-foreground">No labs match your filter.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort('name')}
                  className="flex items-center gap-1 font-medium"
                >
                  Name
                  {renderSortIndicator('name')}
                </button>
              </TableHead>
              <TableHead>Location</TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort('status')}
                  className="flex items-center gap-1 font-medium"
                >
                  Status
                  {renderSortIndicator('status')}
                </button>
              </TableHead>
              <TableHead>Website</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleLabs.map((lab) => (
              <LabTableRow
                key={lab.id}
                lab={lab}
                job={jobs[lab.id]}
                onEdit={() => setEditingLab(lab)}
                onManageTests={() => setManagingLab(lab)}
                onScrape={() => startScrape(lab.id)}
                onShowLogs={() => setLogsLabId(lab.id)}
              />
            ))}
          </TableBody>
        </Table>
      )}

      <AddLabDialog open={addOpen} onOpenChange={setAddOpen} />

      <EditLabDialog
        lab={editingLab}
        open={editingLab !== null}
        onOpenChange={(open) => {
          if (!open) setEditingLab(null)
        }}
      />

      <Dialog
        open={managingLab !== null}
        onOpenChange={(open) => {
          if (!open) setManagingLab(null)
        }}
      >
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tests — {managingLab?.name}</DialogTitle>
            <DialogDescription>
              Manage the tests this lab offers and the biomarkers they cover.
            </DialogDescription>
          </DialogHeader>
          {managingLab && (
            <div className="-mr-2 flex-1 overflow-y-auto pr-2">
              <LabTestEditor labId={managingLab.id} biomarkers={biomarkers} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ScrapeLogsDialog
        open={logsLabId !== null}
        onOpenChange={(open) => {
          if (!open) setLogsLabId(null)
        }}
        labName={logsLabId ? labNameById.get(logsLabId) ?? 'lab' : ''}
        job={logsLabId ? jobs[logsLabId] : undefined}
      />
    </div>
  )
}
