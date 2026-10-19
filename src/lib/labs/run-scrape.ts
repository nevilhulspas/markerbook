import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { collectLabSiteText } from '@/lib/labs/scrape'
import { extractAllLabData } from '@/lib/labs/extract-tests'
import { linkLabTestBiomarkers } from '@/lib/labs/link-biomarkers'
import { normalizeTestKey } from '@/lib/labs/normalize'
import type { Lab } from '@/lib/database.types'

export interface RunLabScrapeArgs {
  labId: string
  onLog?: (msg: string) => void
}

export interface RunLabScrapeResult {
  inserted: number
  skipped: number
  profileUpdated: boolean
}

// A 'running' job not updated in this long is treated as dead (the runner most
// likely died on a server restart), so it never blocks a fresh scrape.
const STALE_RUNNING_MS = 5 * 60 * 1000

/**
 * Id of a fresh, in-progress scrape job for `labId`, or null. Every enqueue path
 * must check this BEFORE running a scrape: runLabScrape dedupes tests via a
 * non-atomic read-then-insert, so two concurrent runs would both read the same
 * `existing` set and insert duplicate rows. A stale 'running' job (no update in
 * >5 min) is ignored so it can't block a legitimate re-scrape.
 */
export async function getActiveScrapeJobId(labId: string): Promise<string | null> {
  const freshSince = new Date(Date.now() - STALE_RUNNING_MS).toISOString()
  const { data } = await supabaseAdmin
    .from('scrape_jobs')
    .select('id')
    .eq('lab_id', labId)
    .eq('status', 'running')
    .gt('updated_at', freshSince)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

/**
 * Core scrape pipeline (no auth gate — callers must enforce admin). Loads the
 * lab, crawls its website, extracts profile + tests via an LLM, fills only the
 * empty profile fields, and inserts new tests (deduped by name, status
 * 'approved'). Progress is reported through `onLog` (URLs / counts / sizes
 * only — never secrets or page bodies).
 *
 * Expected failures (no website, empty fetch, insert error) THROW with a clear
 * message; callers translate these into their own error contract.
 */
export async function runLabScrape({
  labId,
  onLog,
}: RunLabScrapeArgs): Promise<RunLabScrapeResult> {
  const { data: lab } = await supabaseAdmin
    .from('labs')
    .select('*')
    .eq('id', labId)
    .maybeSingle()

  if (!lab) {
    throw new Error('Lab not found')
  }

  const typedLab = lab as Lab
  if (!typedLab.website || typedLab.website.trim().length === 0) {
    throw new Error('Lab has no website to scrape.')
  }

  onLog?.(`Starting scrape of ${typedLab.name}`)
  onLog?.(`Website: ${typedLab.website}`)

  const siteText = await collectLabSiteText(typedLab.website, onLog)
  if (siteText.trim().length === 0) {
    throw new Error('Could not fetch the lab website.')
  }

  const data = await extractAllLabData(siteText, onLog)

  // Profile: only fill fields that are currently empty — never overwrite.
  const profilePatch: Partial<Pick<Lab, 'country' | 'city' | 'description'>> = {}
  if (isEmpty(typedLab.country) && data.profile.country) {
    profilePatch.country = data.profile.country
  }
  if (isEmpty(typedLab.city) && data.profile.city) {
    profilePatch.city = data.profile.city
  }
  if (isEmpty(typedLab.description) && data.profile.description) {
    profilePatch.description = data.profile.description
  }

  let profileUpdated = false
  if (Object.keys(profilePatch).length > 0) {
    const { error: updateError } = await supabaseAdmin
      .from('labs')
      .update({ ...profilePatch, updated_at: new Date().toISOString() })
      .eq('id', labId)
    if (updateError) {
      console.error('runLabScrape: profile update failed', updateError.message)
    } else {
      profileUpdated = true
      onLog?.(`Updated profile fields: ${Object.keys(profilePatch).join(', ')}`)
    }
  }

  // Tests: insert only new (case-insensitive, non-empty) test names.
  const { data: existing } = await supabaseAdmin
    .from('lab_tests')
    .select('name')
    .eq('lab_id', labId)

  const existingNames = new Set(
    ((existing ?? []) as { name: string | null }[])
      .map((r) => normalizeTestKey(r.name ?? ''))
      .filter((n) => n.length > 0)
  )

  const seenInBatch = new Set<string>()
  const rows: Array<{
    lab_id: string
    name: string
    method: string | null
    cost: number | null
    currency: string | null
    turnaround_days: number | null
    sample_type: string | null
    status: 'approved'
  }> = []
  let skipped = 0

  for (const test of data.tests) {
    const name = test.name.trim()
    const key = normalizeTestKey(name)
    if (name.length === 0 || existingNames.has(key) || seenInBatch.has(key)) {
      skipped++
      continue
    }
    seenInBatch.add(key)
    rows.push({
      lab_id: labId,
      name,
      method: test.method,
      cost: test.cost,
      currency: test.currency,
      turnaround_days: test.turnaround_days,
      sample_type: test.sample_type,
      status: 'approved',
    })
  }

  onLog?.(`Inserting ${rows.length} new test(s) (${skipped} already present)`)

  let inserted = 0
  if (rows.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from('lab_tests')
      .insert(rows)
    if (insertError) {
      console.error('runLabScrape: test insert failed', insertError.message)
      throw new Error('Failed to save scraped tests.')
    }
    inserted = rows.length
  }

  // Link tests to catalogue biomarkers (LLM-assisted, validated against the
  // real catalogue). Only unlinked tests are matched, so this also backfills
  // pre-existing tests on a re-scrape. Never fails the scrape over linking.
  try {
    await linkLabTestBiomarkers({ labId, onlyUnlinked: true, onLog })
  } catch (err) {
    console.error('runLabScrape: biomarker linking failed', err)
    onLog?.('Biomarker linking failed (tests were still saved)')
  }

  // NOTE: do NOT call revalidatePath here — runLabScrape also runs inside the
  // detached background job (runScrapeJob), where revalidatePath is unsupported
  // ("during render" error). Synchronous action callers (adminScrapeLab,
  // submitLab) revalidate themselves; the durable path relies on client polling.
  onLog?.(`Done: ${inserted} added, ${skipped} skipped`)

  return { inserted, skipped, profileUpdated }
}

function isEmpty(value: string | null): boolean {
  return value === null || value.trim().length === 0
}

/**
 * Durable background runner: executes {@link runLabScrape} against an existing
 * `scrape_jobs` row, streaming progress into the DB so a polling client can
 * re-attach across page loads / server restarts. No auth gate — the enqueue
 * route is responsible for `requireAdmin`. Resolves once the terminal state
 * (`done` | `error`) and complete logs are persisted; never throws.
 */
export async function runScrapeJob(jobId: string, labId: string): Promise<void> {
  const lines: string[] = []

  // Throttled log flush: at most one update in-flight, with a trailing flush
  // for anything that arrived while a write was running. `lines` only grows,
  // so last-write-wins stays monotonic and never loses progress.
  let flushing = false
  let dirty = false

  const flush = async (): Promise<void> => {
    flushing = true
    try {
      await supabaseAdmin
        .from('scrape_jobs')
        .update({ logs: lines.join('\n'), updated_at: new Date().toISOString() })
        .eq('id', jobId)
    } catch (e) {
      console.error('runScrapeJob: log flush failed', e)
    }
    if (dirty) {
      dirty = false
      await flush()
    } else {
      flushing = false
    }
  }

  const scheduleFlush = (): void => {
    if (flushing) {
      dirty = true
      return
    }
    void flush()
  }

  const onLog = (msg: string): void => {
    lines.push(msg)
    scheduleFlush()
  }

  try {
    const result = await runLabScrape({ labId, onLog })

    // Auto-publish a user-submitted (pending) lab once the scrape gives it ≥1
    // test. Rejected/errored/0-test scrapes leave it pending (hidden). Never
    // touches an already-approved lab.
    try {
      const { data: lab } = await supabaseAdmin
        .from('labs')
        .select('status')
        .eq('id', labId)
        .maybeSingle()
      if ((lab as { status?: string } | null)?.status === 'pending') {
        const { count } = await supabaseAdmin
          .from('lab_tests')
          .select('id', { count: 'exact', head: true })
          .eq('lab_id', labId)
        if ((count ?? 0) > 0) {
          // Atomic check-then-act: only advance pending → approved, so an admin
          // who rejects the lab between the SELECT above and this UPDATE isn't
          // silently overwritten.
          await supabaseAdmin
            .from('labs')
            .update({ status: 'approved', updated_at: new Date().toISOString() })
            .eq('id', labId)
            .eq('status', 'pending')
          onLog(`Published lab (${count} test(s) imported)`)
        } else {
          onLog('Kept pending: no tests found to publish')
        }
      }
    } catch (e) {
      console.error('runScrapeJob: auto-publish check failed', e)
    }

    await supabaseAdmin
      .from('scrape_jobs')
      .update({
        status: 'done',
        logs: lines.join('\n'),
        inserted: result.inserted,
        skipped: result.skipped,
        profile_updated: result.profileUpdated,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scrape failed'
    await supabaseAdmin
      .from('scrape_jobs')
      .update({
        status: 'error',
        logs: lines.join('\n'),
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
  }
}
