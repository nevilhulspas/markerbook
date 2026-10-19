'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { getScrapeJob, getLatestScrapeJobs } from '@/actions/admin/scrape-jobs'
import {
  SCRAPE_POLL_INTERVAL_MS,
  isScrapeJobFinished,
  lostContactView,
  missingJobView,
  scrapeStartErrorMessage,
  toView,
  withStartError,
  type ScrapeJobView,
} from '@/components/admin/labs/scrape-job-view'

// A read failure is usually transient (network blip, server restart), so the
// poll loop retries; only this many failures in a row stop it.
const MAX_CONSECUTIVE_READ_FAILURES = 5

// Per-lab scrape jobs, keyed by lab id. The actual work runs server-side as a
// durable `scrape_jobs` row; here we poll it. Each lab polls independently so
// scraping lab A never blocks lab B.
export function useScrapeJobPolling(labNameById: Map<string, string>) {
  const router = useRouter()
  const [jobs, setJobs] = useState<Record<string, ScrapeJobView>>({})

  // jobIds we already have a poll loop for — guards against double-polling the
  // same job (e.g. startScrape then a re-attach effect racing the same row).
  const pollingRef = useRef<Set<string>>(new Set())
  // Flipped false on unmount so in-flight loops stop touching state.
  const mountedRef = useRef(true)

  // Poll a single durable job until it leaves the 'running' state. Functional
  // setJobs keeps concurrent loops from clobbering each other.
  const pollJob = useCallback(
    async (labId: string, jobId: string) => {
      if (pollingRef.current.has(jobId)) return
      pollingRef.current.add(jobId)
      const labName = labNameById.get(labId) ?? 'lab'
      let failures = 0
      try {
        for (;;) {
          if (!mountedRef.current) return
          let job: Awaited<ReturnType<typeof getScrapeJob>>
          try {
            job = await getScrapeJob(jobId)
            failures = 0
          } catch (e) {
            if (!mountedRef.current) return
            failures++
            if (failures >= MAX_CONSECUTIVE_READ_FAILURES) {
              // The job may still be running server-side; a refresh re-attaches.
              console.error('pollJob: giving up after repeated read failures', e)
              setJobs((prev) => ({ ...prev, [labId]: lostContactView(prev[labId], jobId) }))
              toast.error(`Lost contact with the scrape for ${labName}. Refresh to check on it.`)
              break
            }
            await new Promise((r) => setTimeout(r, SCRAPE_POLL_INTERVAL_MS))
            continue
          }
          if (!mountedRef.current) return

          if (!job) {
            // Row vanished (e.g. deleted) — surface a terminal error.
            setJobs((prev) => ({ ...prev, [labId]: missingJobView(prev[labId], jobId) }))
            toast.error(`Scrape job not found for ${labName}.`)
            break
          }

          const view = toView(job)
          setJobs((prev) => ({ ...prev, [labId]: view }))

          if (isScrapeJobFinished(job)) {
            if (job.status === 'done') {
              toast.success(`Scraped ${labName}: ${view.summary}`)
              router.refresh()
            } else {
              toast.error(`Scrape failed for ${labName}: ${job.error ?? 'unknown error'}`)
            }
            break
          }

          await new Promise((r) => setTimeout(r, SCRAPE_POLL_INTERVAL_MS))
        }
      } finally {
        pollingRef.current.delete(jobId)
      }
    },
    [labNameById, router]
  )

  async function startScrape(labId: string) {
    // Don't double-start an already-running job for the same lab.
    if (jobs[labId]?.status === 'running') return

    const labName = labNameById.get(labId) ?? 'lab'

    let res: Response
    try {
      res = await fetch(`/api/labs/${labId}/scrape`, { method: 'POST' })
    } catch {
      setJobs((prev) => ({
        ...prev,
        [labId]: withStartError(prev[labId], 'Network error starting scrape.'),
      }))
      toast.error(`Failed to start scrape for ${labName}.`)
      return
    }

    if (!res.ok) {
      const message = scrapeStartErrorMessage(res.status)
      setJobs((prev) => ({ ...prev, [labId]: withStartError(prev[labId], message) }))
      toast.error(`Failed to start scrape for ${labName}.`)
      return
    }

    const { jobId } = (await res.json()) as { jobId: string }
    setJobs((prev) => ({
      ...prev,
      [labId]: { jobId, status: 'running', logs: [], summary: null },
    }))
    void pollJob(labId, jobId)
  }

  // Lifecycle: track mount so poll loops can bail after unmount.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Re-attach on mount: load the latest job per lab so a scrape (running or
  // finished) survives refresh/navigation, and resume polling any still-running
  // ones to keep their logs + spinner live.
  useEffect(() => {
    void (async () => {
      const latest = await getLatestScrapeJobs()
      if (!mountedRef.current) return
      for (const [labId, job] of Object.entries(latest)) {
        setJobs((prev) => ({ ...prev, [labId]: toView(job) }))
        if (job.status === 'running') void pollJob(labId, job.id)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { jobs, startScrape }
}
