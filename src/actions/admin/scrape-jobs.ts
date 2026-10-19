'use server'

import 'server-only'
import { requireAdmin } from '@/lib/auth/require-admin'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ScrapeJob } from '@/lib/database.types'

// A 'running' job whose row hasn't been touched in this long is treated as
// dead — the persistent Node process most likely restarted mid-scrape, so the
// runner that would have written the terminal state is gone.
const STALE_RUNNING_MS = 5 * 60 * 1000

const INTERRUPTED_MESSAGE =
  'Interrupted — the server restarted during the scrape. Run it again.'

/**
 * If `job` is a 'running' row that has gone stale (no update in >5 min), return
 * it overridden to a terminal 'error' state and best-effort persist that flip
 * (fire-and-forget — the returned override is authoritative regardless). Other
 * jobs (and null) pass through unchanged.
 */
function withStaleCheck(job: ScrapeJob | null): ScrapeJob | null {
  if (!job) return null
  if (job.status !== 'running') return job

  const updatedAt = new Date(job.updated_at).getTime()
  if (Number.isNaN(updatedAt) || Date.now() - updatedAt <= STALE_RUNNING_MS) {
    return job
  }

  // Best-effort: mark the row so future reads (and other clients) agree.
  void supabaseAdmin
    .from('scrape_jobs')
    .update({
      status: 'error',
      error: INTERRUPTED_MESSAGE,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .then(undefined, (e) => console.error('withStaleCheck: persist failed', e))

  return { ...job, status: 'error', error: INTERRUPTED_MESSAGE }
}

/**
 * Admin-only: fetch a single scrape job by id, applying the stale-running
 * override. Returns null when no such job exists; throws when the read fails,
 * so a transient error is not mistaken for a deleted job.
 */
export async function getScrapeJob(jobId: string): Promise<ScrapeJob | null> {
  await requireAdmin()

  const { data, error } = await supabaseAdmin
    .from('scrape_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle()
  if (error) throw new Error(`Could not read scrape job: ${error.message}`)

  return withStaleCheck((data as ScrapeJob | null) ?? null)
}

/**
 * Admin-only: the LATEST scrape job per lab, keyed by `lab_id`. Lets the client
 * re-attach to in-flight / recent jobs on page load. Stale-running jobs are
 * surfaced as errors via {@link withStaleCheck}.
 */
export async function getLatestScrapeJobs(): Promise<Record<string, ScrapeJob>> {
  await requireAdmin()

  // DISTINCT ON (lab_id) RPC returns exactly one (newest) job per lab regardless
  // of total job volume — no newest-N cap that could silently drop a lab whose
  // latest job falls outside the window. (Migration: harden_lab_directory.)
  const { data, error } = await supabaseAdmin.rpc('get_latest_scrape_jobs')
  if (error) {
    console.error('getLatestScrapeJobs RPC failed:', error.message)
    return {}
  }

  const rows = (data as ScrapeJob[] | null) ?? []
  const latest: Record<string, ScrapeJob> = {}
  for (const row of rows) {
    const checked = withStaleCheck(row)
    if (checked) latest[row.lab_id] = checked
  }

  return latest
}
