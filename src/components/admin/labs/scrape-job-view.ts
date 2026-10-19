import type { ScrapeJob } from '@/lib/database.types'

// Client-side projection of a durable `scrape_jobs` row.
export type ScrapeJobView = {
  jobId: string
  status: 'running' | 'done' | 'error'
  logs: string[]
  summary: string | null
}

// How long a poll loop waits between `getScrapeJob` reads.
export const SCRAPE_POLL_INTERVAL_MS = 1500

// Map a persisted job row to the view the table renders. `logs` is a
// newline-joined string in the row; split it into lines (dropping blanks).
export function toView(job: ScrapeJob): ScrapeJobView {
  return {
    jobId: job.id,
    status: job.status,
    logs: job.logs ? job.logs.split('\n').filter((l) => l.length > 0) : [],
    summary:
      job.status === 'done'
        ? `Added ${job.inserted}, skipped ${job.skipped}` +
          (job.profile_updated ? ', profile updated' : '')
        : job.status === 'error'
          ? (job.error ?? 'Scrape failed')
          : null,
  }
}

// Poll stop condition: a job is finished once it leaves the 'running' state.
export function isScrapeJobFinished(job: ScrapeJob): boolean {
  return job.status !== 'running'
}

// Message for a non-OK response from the scrape start endpoint.
export function scrapeStartErrorMessage(status: number): string {
  return status === 403 ? 'Forbidden.' : `Request failed (${status}).`
}

// The view after starting a scrape failed: keep the lab's previous job id and
// logs, append the message, and surface it as the summary.
export function withStartError(
  prev: ScrapeJobView | undefined,
  message: string
): ScrapeJobView {
  return {
    jobId: prev?.jobId ?? '',
    status: 'error',
    logs: [...(prev?.logs ?? []), message],
    summary: message,
  }
}

// The view when the polled row vanished (e.g. deleted): a terminal error that
// keeps whatever logs were already shown.
export function missingJobView(
  prev: ScrapeJobView | undefined,
  jobId: string
): ScrapeJobView {
  return {
    jobId,
    status: 'error',
    logs: prev?.logs ?? [],
    summary: 'Scrape job not found.',
  }
}

// The view when polling gave up after repeated read failures. The job may still
// be running server-side, but the view must leave 'running' so the Scrape
// button works again; a refresh re-attaches to the real state.
export function lostContactView(
  prev: ScrapeJobView | undefined,
  jobId: string
): ScrapeJobView {
  return {
    jobId,
    status: 'error',
    logs: prev?.logs ?? [],
    summary: 'Lost contact with the scrape. Refresh to check on it.',
  }
}
