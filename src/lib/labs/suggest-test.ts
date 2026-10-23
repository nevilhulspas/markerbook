import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchPageText } from '@/lib/labs/scrape'
import { registrableDomain } from '@/lib/labs/domain'
import { extractLabDataFromText } from '@/lib/labs/extract-tests'
import { linkLabTestBiomarkers } from '@/lib/labs/link-biomarkers'
import { normalizeTestKey } from '@/lib/labs/normalize'

/** Expected, user-facing failure. Callers map `.message` to UI text. */
export class SuggestTestError extends Error {}

export interface SuggestLabTestArgs {
  labId: string
  url: string
  userId: string
}

export interface SuggestLabTestResult {
  added: string[]
  duplicates: string[]
}

// Bound how many tests a single suggestion can add (e.g. when a user pastes a
// large category page instead of one product page). Tests beyond this cap are
// silently dropped — neither inserted nor reported in `added`/`duplicates`.
// This is intentional: the feature targets adding the one missing test a user
// found, and the cap only guards against a bulk paste; it is not a bug.
const MAX_SUGGESTED_TESTS_PER_CALL = 25

/**
 * Validate a single product-page `url` on a lab's own domain, extract the
 * test(s) it lists (translated to English), de-dupe against the lab's existing
 * tests, and insert the new ones as `pending` (provenance: `submitted_by`):
 * they show up for everyone only after an admin approves them in /admin/labs.
 * Newly inserted tests are linked to catalogue biomarkers (best-effort).
 *
 * No auth gate — the calling action enforces sign-in + rate limiting. Throws
 * {@link SuggestTestError} for every expected failure (bad domain, unreadable
 * page, not a test); the action maps these to friendly messages.
 */
export async function suggestLabTestFromUrl({
  labId,
  url,
  userId,
}: SuggestLabTestArgs): Promise<SuggestLabTestResult> {
  const { data: lab } = await supabaseAdmin
    .from('labs')
    .select('id, website, status')
    .eq('id', labId)
    .maybeSingle()
  if (!lab) throw new SuggestTestError('Lab not found.')
  const labRow = lab as {
    id: string
    website: string | null
    status: 'pending' | 'approved' | 'rejected'
  }
  // Enforce the same gate the UI shows: only approved labs accept suggestions.
  // Server actions are directly callable, so without this check a user could
  // POST any labId (pending or rejected) and have approved tests inserted,
  // bypassing the admin's decision.
  if (labRow.status !== 'approved') {
    throw new SuggestTestError("This lab isn't available for suggestions.")
  }
  if (!labRow.website || labRow.website.trim().length === 0) {
    throw new SuggestTestError('This lab has no website to check the page against.')
  }

  // Same registrable-domain guard: the page must be on the lab's own site.
  let urlDomain: string
  let labDomain: string
  try {
    urlDomain = registrableDomain(new URL(url).hostname)
    labDomain = registrableDomain(new URL(labRow.website).hostname)
  } catch {
    throw new SuggestTestError('Enter a valid page URL (https://…).')
  }
  if (urlDomain.length === 0 || urlDomain !== labDomain) {
    throw new SuggestTestError("That page isn't on this lab's website.")
  }

  // Fetch the single page. fetchPageText SSRF-guards every hop; we also pass
  // the lab's hostname so the same-registrable-domain check is enforced on
  // every redirect — without that, an open redirector on the lab's site could
  // bounce the fetch to an attacker-controlled page and feed its content to the
  // LLM as if it were the lab's own.
  const { text } = await fetchPageText(url, {
    enforceSameRegistrableDomain: new URL(labRow.website).hostname,
  })
  if (text.trim().length === 0) {
    throw new SuggestTestError("Couldn't read that page. Check the link and try again.")
  }

  const data = await extractLabDataFromText(text)
  if (data.tests.length === 0) {
    throw new SuggestTestError("That page doesn't look like a lab test we can add.")
  }

  // Dedup against existing tests for this lab (case-insensitive) + within the
  // batch. Approved rows are listed and pending rows already wait for review,
  // so both count as "already listed"; a rejected row must not block a
  // re-suggestion of the same name.
  const { data: existing } = await supabaseAdmin
    .from('lab_tests')
    .select('name')
    .eq('lab_id', labId)
    .in('status', ['approved', 'pending'])
  const existingNames = new Set(
    ((existing ?? []) as { name: string | null }[])
      .map((r) => normalizeTestKey(r.name ?? ''))
      .filter((n) => n.length > 0)
  )

  const seenInBatch = new Set<string>()
  const added: string[] = []
  const duplicates: string[] = []
  const rows: Array<{
    lab_id: string
    name: string
    method: string | null
    cost: number | null
    currency: string | null
    turnaround_days: number | null
    sample_type: string | null
    status: 'pending'
    submitted_by: string
  }> = []

  for (const test of data.tests) {
    const name = test.name.trim()
    if (name.length === 0) continue
    const key = normalizeTestKey(name)
    if (existingNames.has(key) || seenInBatch.has(key)) {
      duplicates.push(name)
      continue
    }
    if (rows.length >= MAX_SUGGESTED_TESTS_PER_CALL) break
    seenInBatch.add(key)
    added.push(name)
    rows.push({
      lab_id: labId,
      name,
      method: test.method,
      cost: test.cost,
      currency: test.currency,
      turnaround_days: test.turnaround_days,
      sample_type: test.sample_type,
      status: 'pending',
      submitted_by: userId,
    })
  }

  if (rows.length === 0) {
    // Everything found on the page is already listed.
    return { added, duplicates }
  }

  const { error: insertError } = await supabaseAdmin.from('lab_tests').insert(rows)
  if (insertError) {
    console.error('suggestLabTestFromUrl: insert failed', insertError)
    throw new SuggestTestError('Could not save the test. Please try again.')
  }

  // Link new tests to catalogue biomarkers (best-effort — never fail the add).
  try {
    await linkLabTestBiomarkers({ labId, onlyUnlinked: true })
  } catch (err) {
    console.error('suggestLabTestFromUrl: biomarker linking failed', err)
  }

  return { added, duplicates }
}
