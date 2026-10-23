'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { runScrapeJob } from '@/lib/labs/run-scrape'
import { runChargingAiCalls } from '@/lib/ai/charge'
import { isAiConfigured } from '@/lib/ai/config'
import { isUniqueViolation, userErrorMessage } from '@/lib/supabase/errors'
import { labSubmissionSchema } from '@/lib/validations/lab'
import type { Lab, LabTest } from '@/lib/database.types'
import type { TableRow } from '@/lib/supabase/database'

const MAX_PENDING_SUBMISSIONS = 5

/** Review fields that only admins see (who submitted / reviewed, and notes). */
type ReviewFields = 'submitted_by' | 'reviewed_by' | 'review_notes'

/** A lab as any signed-in user may read it (no submitter/reviewer ids). */
export type PublicLab = Omit<Lab, ReviewFields>
/** A lab test as any signed-in user may read it (no submitter/reviewer ids). */
export type PublicLabTest = Omit<LabTest, ReviewFields>

// Explicit column lists: the user-facing role cannot read the review fields
// (column grants in migration 20261023120200), so `*` would be refused.
const PUBLIC_LAB_COLUMNS =
  'id, name, country, city, website, description, status, reviewed_at, created_at, updated_at'
const PUBLIC_LAB_TEST_COLUMNS =
  'id, lab_id, name, method, cost, currency, turnaround_days, sample_type, provider, notes, status, reviewed_at, created_at, updated_at'

export interface LabTestWithBiomarkers extends PublicLabTest {
  biomarkers: { id: string; name: string; short_name: string | null }[]
}
export interface LabDetail {
  lab: PublicLab
  tests: LabTestWithBiomarkers[]
}
export interface LabOfferingForBiomarker {
  labId: string
  labName: string
  country: string | null
  city: string | null
  testId: string
  testName: string
  method: string | null
  cost: number | null
  currency: string | null
}

export async function getApprovedLabs(opts?: {
  country?: string
}): Promise<PublicLab[]> {
  const supabase = await createClient()
  let q = supabase
    .from('labs')
    .select(PUBLIC_LAB_COLUMNS)
    .eq('status', 'approved')
    .order('name')
  if (opts?.country) q = q.eq('country', opts.country)
  const { data, error } = await q
  if (error) console.error('getApprovedLabs query failed:', error.message)
  return (data ?? []) as PublicLab[]
}

type LabTestWithBiomarkerJoin = Omit<TableRow<'lab_tests'>, ReviewFields> & {
  lab_test_biomarkers: {
    biomarkers: { id: string; name: string; short_name: string | null } | null
  }[]
}

/** Shape a lab_tests query (with nested biomarkers) into LabTestWithBiomarkers[]. */
function mapLabTests(tests: LabTestWithBiomarkerJoin[] | null): LabTestWithBiomarkers[] {
  return (tests ?? []).map((t) => ({
    ...t,
    biomarkers: (t.lab_test_biomarkers ?? [])
      .map((j) => j.biomarkers)
      .filter((b): b is NonNullable<typeof b> => Boolean(b)),
  }))
}

export async function getLabDetail(id: string): Promise<LabDetail | null> {
  const supabase = await createClient()

  // Public path: an approved lab (RLS via user-context client).
  const { data: approvedLab, error: labError } = await supabase
    .from('labs')
    .select(PUBLIC_LAB_COLUMNS)
    .eq('id', id)
    .eq('status', 'approved')
    .maybeSingle()
  if (labError) console.error('getLabDetail lab query failed:', labError.message)

  if (approvedLab) {
    const { data: tests, error: testsError } = await supabase
      .from('lab_tests')
      .select(`${PUBLIC_LAB_TEST_COLUMNS}, lab_test_biomarkers(biomarkers(id, name, short_name))` as const)
      .eq('lab_id', id)
      .eq('status', 'approved')
      .order('name')
    if (testsError)
      console.error('getLabDetail tests query failed:', testsError.message)
    return {
      lab: approvedLab as PublicLab,
      tests: mapLabTests(tests),
    }
  }

  // Submitter path: the user who suggested a lab can watch it import and wait
  // for review, with its pending tests. Everyone else gets null (→ notFound).
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: ownLab } = await supabaseAdmin
    .from('labs')
    .select(PUBLIC_LAB_COLUMNS)
    .eq('id', id)
    .eq('submitted_by', user.id)
    .maybeSingle()
  if (!ownLab) return null

  const { data: ownTests } = await supabaseAdmin
    .from('lab_tests')
    .select(`${PUBLIC_LAB_TEST_COLUMNS}, lab_test_biomarkers(biomarkers(id, name, short_name))` as const)
    .eq('lab_id', id)
    .in('status', ['approved', 'pending'])
    .order('name')

  return {
    lab: ownLab as PublicLab,
    tests: mapLabTests(ownTests),
  }
}

export interface LabWithTestCount extends PublicLab {
  testCount: number
}

/** Read result: `error` is set when the query failed, so it never looks like an empty list. */
export type LabsReadResult<T> = { data: T[]; error: null } | { data: null; error: string }

export async function getApprovedLabsWithTestCount(opts?: {
  country?: string
}): Promise<LabsReadResult<LabWithTestCount>> {
  const supabase = await createClient()
  let q = supabase
    .from('labs')
    // Test ids, counted below: an embedded `lab_tests(count)` needs table-wide
    // SELECT, which signed-in users no longer have (column grants, migration
    // 20261023120200).
    .select(`${PUBLIC_LAB_COLUMNS}, lab_tests(id)` as const)
    .eq('status', 'approved')
    .order('name')
  if (opts?.country) q = q.eq('country', opts.country)
  const { data, error } = await q
  if (error) {
    return {
      data: null,
      error: userErrorMessage(
        'getApprovedLabsWithTestCount',
        error,
        'Could not load the labs. Please try again.'
      ),
    }
  }
  return {
    data: (data ?? []).map((r) => {
      const { lab_tests, ...lab } = r
      return { ...(lab as PublicLab), testCount: lab_tests?.length ?? 0 }
    }),
    error: null,
  }
}

export async function getLabsForBiomarker(
  biomarkerId: string
): Promise<LabsReadResult<LabOfferingForBiomarker>> {
  const supabase = await createClient()
  // RLS ensures only approved lab_tests/labs are returned to the user-context client.
  const { data, error } = await supabase
    .from('lab_test_biomarkers')
    .select(
      'lab_tests!inner(id, name, method, cost, currency, labs!inner(id, name, country, city))'
    )
    .eq('biomarker_id', biomarkerId)
  if (error) {
    return {
      data: null,
      error: userErrorMessage(
        'getLabsForBiomarker',
        error,
        'Could not load the labs for this marker. Please try again.'
      ),
    }
  }

  return {
    data: (data ?? []).map((r) => ({
      labId: r.lab_tests.labs.id,
      labName: r.lab_tests.labs.name,
      country: r.lab_tests.labs.country,
      city: r.lab_tests.labs.city,
      testId: r.lab_tests.id,
      testName: r.lab_tests.name,
      method: r.lab_tests.method,
      cost: r.lab_tests.cost,
      currency: r.lab_tests.currency,
    })),
    error: null,
  }
}

export interface LabImportState {
  status: 'running' | 'done' | 'error' | null
  tests: number
}

/**
 * Safe, user-facing import status for a lab the user may view (approved, or
 * their own pending submission). Returns only the latest scrape job's status +
 * the lab's test count — never the job logs (which can contain scraped text).
 */
export async function getLabImportStatus(labId: string): Promise<LabImportState> {
  const empty: LabImportState = { status: null, tests: 0 }
  const { user } = await getSessionUser()
  if (!user) return empty

  const { data: lab } = await supabaseAdmin
    .from('labs')
    .select('status, submitted_by')
    .eq('id', labId)
    .maybeSingle()
  const typed = lab as { status: string; submitted_by: string | null } | null
  if (!typed) return empty
  if (typed.status !== 'approved' && typed.submitted_by !== user.id) return empty

  const { data: job } = await supabaseAdmin
    .from('scrape_jobs')
    .select('status')
    .eq('lab_id', labId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { count } = await supabaseAdmin
    .from('lab_tests')
    .select('id', { count: 'exact', head: true })
    .eq('lab_id', labId)

  return {
    status:
      ((job as { status?: string } | null)?.status as LabImportState['status']) ?? null,
    tests: count ?? 0,
  }
}

/**
 * User-facing lab suggestion. Creates the lab as `pending` and fires the durable
 * scrape, which imports its tests as `pending` too. Nothing is shown to other
 * users until an admin approves the lab in /admin/labs. Returns the new lab id
 * so the client can navigate to it.
 */
export async function submitLab(
  values: unknown
): Promise<{ data: { labId: string } | null; error: string | null }> {
  const parsed = labSubmissionSchema.safeParse(values)
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? 'Invalid submission.' }
  }

  const { user, authError } = await getSessionUser()
  if (!user) return { data: null, error: authError ?? 'You must be signed in to suggest a lab.' }

  // A suggested lab is imported by reading its website with the AI.
  if (!isAiConfigured()) {
    return {
      data: null,
      error: 'Suggesting a lab needs AI, which is not set up on this server. Ask the admin to add the lab.',
    }
  }

  // Rate limit: cap pending submissions per user.
  const { count: pendingCount } = await supabaseAdmin
    .from('labs')
    .select('id', { count: 'exact', head: true })
    .eq('submitted_by', user.id)
    .eq('status', 'pending')
  if ((pendingCount ?? 0) >= MAX_PENDING_SUBMISSIONS) {
    return {
      data: null,
      error: `You have ${MAX_PENDING_SUBMISSIONS} labs waiting for review. Please wait for those before suggesting more.`,
    }
  }

  const { name, website, country, city } = parsed.data
  let host = ''
  try {
    host = new URL(website).host.toLowerCase()
  } catch {
    return { data: null, error: 'Enter a valid website URL (https://…)' }
  }

  // Dedupe in JS against existing labs (small table) by name or website host —
  // avoids interpolating user text into a PostgREST filter string.
  const { data: allLabs } = await supabaseAdmin
    .from('labs')
    .select('id, name, website, status')
  const nName = name.toLowerCase()
  const dup = (allLabs ?? []).find((l) => {
    const row = l as { name: string | null; website: string | null }
    if ((row.name ?? '').toLowerCase().trim() === nName) return true
    if (host && row.website) {
      try {
        return new URL(row.website).host.toLowerCase() === host
      } catch {
        return false
      }
    }
    return false
  })
  if (dup) {
    const d = dup as { name: string; status: string }
    return {
      data: null,
      error:
        d.status === 'approved'
          ? `That lab is already listed ("${d.name}").`
          : 'That lab has already been suggested.',
    }
  }

  const { data: lab, error: insertError } = await supabaseAdmin
    .from('labs')
    .insert({
      name,
      website,
      country: country ?? null,
      city: city ?? null,
      status: 'pending',
      submitted_by: user.id,
    })
    .select('id')
    .single()
  if (insertError || !lab) {
    // The JS dedup above is best-effort; a concurrent submit of the same lab can
    // slip past it (both read before either inserts). The DB unique index on
    // name/website is the backstop — surface it as the same friendly message.
    if (isUniqueViolation(insertError)) {
      return { data: null, error: 'That lab is already listed or waiting for review.' }
    }
    return { data: null, error: insertError?.message ?? 'Could not create the lab.' }
  }
  const labId = (lab as { id: string }).id

  // Durable auto-scrape; the lab stays pending until an admin approves it.
  const { data: job, error: jobError } = await supabaseAdmin
    .from('scrape_jobs')
    .insert({ lab_id: labId, status: 'running' })
    .select('id')
    .single()
  if (jobError || !job) {
    // The lab row exists but its scrape never started — surface it so the user
    // can retry, rather than leaving a pending lab with no tests to review.
    console.error('submitLab: could not create scrape job', jobError?.message)
    return { data: null, error: 'Lab was saved but the import could not start. Please try again.' }
  }
  // Every model call of this scrape counts against the submitter's AI limit;
  // over it, the remaining calls fail and the scrape saves what it has.
  void runChargingAiCalls(user.id, () => runScrapeJob((job as { id: string }).id, labId)).catch((e) =>
    console.error('submitLab: scrape crashed', e)
  )

  revalidatePath('/labs')
  return { data: { labId }, error: null }
}
