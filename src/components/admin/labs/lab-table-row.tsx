'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DownloadCloud, ExternalLink, Loader2, ScrollText, Trash2 } from 'lucide-react'

import { adminSetLabStatus, adminDeleteLab } from '@/actions/admin/labs'
import type { Lab, LabStatus } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { STATUS_OPTIONS, selectClassName } from '@/components/admin/labs/lab-form-values'
import type { ScrapeJobView } from '@/components/admin/labs/scrape-job-view'

function labLocation(lab: Lab): string {
  return [lab.city, lab.country].filter(Boolean).join(', ') || '—'
}

interface LabTableRowProps {
  lab: Lab
  job: ScrapeJobView | undefined
  onEdit: () => void
  onManageTests: () => void
  onScrape: () => void
  onShowLogs: () => void
}

export function LabTableRow({
  lab,
  job,
  onEdit,
  onManageTests,
  onScrape,
  onShowLogs,
}: LabTableRowProps) {
  const router = useRouter()
  // useTransition only gates status-change / delete; the scrape is a durable
  // background job polled by the parent, so it never blocks this row's other
  // actions (or other rows).
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isScraping = job?.status === 'running'

  function handleStatusChange(next: LabStatus) {
    if (next === lab.status) return
    setError(null)
    startTransition(async () => {
      const result = await adminSetLabStatus(lab.id, next)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleDelete() {
    if (
      !window.confirm(
        `Delete "${lab.name}"? This also deletes its tests and biomarker links.`
      )
    ) {
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await adminDeleteLab(lab.id)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{lab.name}</TableCell>
      <TableCell className="text-muted-foreground">{labLocation(lab)}</TableCell>
      <TableCell>
        <select
          aria-label={`Status for ${lab.name}`}
          value={lab.status}
          onChange={(e) => handleStatusChange(e.target.value as LabStatus)}
          disabled={isPending}
          className={`${selectClassName} w-auto`}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
      </TableCell>
      <TableCell>
        {lab.website ? (
          <a
            href={lab.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
          >
            <ExternalLink className="size-3.5" />
            Visit
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}>
            Edit
          </Button>
          <Button size="sm" variant="outline" onClick={onManageTests}>
            Tests
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onScrape}
            disabled={isScraping || !lab.website}
            title={!lab.website ? 'Add a website first' : undefined}
          >
            {isScraping ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : (
              <DownloadCloud className="mr-1 size-3" />
            )}
            Scrape
          </Button>
          {job && (
            <Button size="sm" variant="outline" onClick={onShowLogs}>
              <ScrollText className="mr-1 size-3" />
              Logs
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            <Trash2 className="mr-1 size-3" />
            Delete
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
