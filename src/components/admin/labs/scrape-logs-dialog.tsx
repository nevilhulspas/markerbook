'use client'

import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ScrapeJobView } from '@/components/admin/labs/scrape-job-view'

interface ScrapeLogsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  labName: string
  job: ScrapeJobView | undefined
}

export function ScrapeLogsDialog({ open, onOpenChange, labName, job }: ScrapeLogsDialogProps) {
  const consoleRef = useRef<HTMLDivElement>(null)
  const logCount = job?.logs.length ?? 0

  // Auto-scroll to the bottom as new lines arrive.
  useEffect(() => {
    const el = consoleRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logCount, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Scrape logs — {labName}</DialogTitle>
          <DialogDescription>
            {job?.status === 'running' ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-3.5 animate-spin" />
                Running…
              </span>
            ) : job?.status === 'error' ? (
              <span className="text-destructive">Error</span>
            ) : job?.status === 'done' ? (
              <span>Done{job.summary ? ` — ${job.summary}` : ''}</span>
            ) : (
              'No scrape has run for this lab yet.'
            )}
          </DialogDescription>
        </DialogHeader>
        <div
          ref={consoleRef}
          className="bg-muted max-h-[60vh] overflow-y-auto rounded-md p-3 font-mono text-xs"
        >
          {job && job.logs.length > 0 ? (
            job.logs.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-words">
                {line}
              </div>
            ))
          ) : (
            <span className="text-muted-foreground">Waiting for logs…</span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
