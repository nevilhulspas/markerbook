import { requireAdmin } from '@/lib/auth/require-admin'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getActiveScrapeJobId, runScrapeJob } from '@/lib/labs/run-scrape'

/**
 * Admin-only: enqueue a durable background scrape.
 *
 * Creates a `scrape_jobs` row (status 'running'), then fires {@link runScrapeJob}
 * fire-and-forget. On a persistent Node server (Dokploy) the runner keeps going
 * after this handler responds, writing progress + the terminal state back to the
 * job row. The client polls the row (see `getScrapeJob`) to follow along.
 *
 * Auth is gated by requireAdmin before any work; non-admins get a 403.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    await requireAdmin()
  } catch {
    return new Response('Forbidden', { status: 403 })
  }

  const { id } = await params

  // Guard against concurrent scrapes for the same lab (e.g. a user-submitted
  // lab's auto-scrape racing an admin click). Reuse the in-flight job instead
  // of starting a second run that would race the dedupe and duplicate rows.
  const activeJobId = await getActiveScrapeJobId(id)
  if (activeJobId) {
    return Response.json({ jobId: activeJobId, alreadyRunning: true })
  }

  const { data, error } = await supabaseAdmin
    .from('scrape_jobs')
    .insert({ lab_id: id, status: 'running' })
    .select('id')
    .single()

  if (error || !data) {
    return Response.json({ error: 'Could not start scrape job' }, { status: 500 })
  }

  const jobId = data.id as string

  // Fire-and-forget: keeps running in the persistent Node process after we
  // respond. The .catch prevents an unhandled rejection if the runner itself
  // (rather than the scrape) crashes — runScrapeJob already persists expected
  // failures as the job's terminal 'error' state.
  void runScrapeJob(jobId, id).catch((e) => console.error('runScrapeJob crashed', e))

  return Response.json({ jobId })
}
