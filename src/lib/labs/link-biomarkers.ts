import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { CatalogBiomarker } from '@/lib/labs/match-test-biomarkers'
import { matchTestsToBiomarkers } from '@/lib/labs/match-test-biomarkers'

export interface LinkBiomarkersArgs {
  labId: string
  /** When true (default) only tests that have NO links yet are matched. */
  onlyUnlinked?: boolean
  onLog?: (msg: string) => void
}

export interface LinkBiomarkersResult {
  testsConsidered: number
  testsLinked: number
  linksInserted: number
}

const INSERT_BATCH = 500

/**
 * Match a lab's tests to catalogue biomarkers (via the LLM) and persist the
 * results as `lab_test_biomarkers` rows. No auth gate — callers must enforce
 * admin. By default only tests without any existing links are matched, so
 * re-runs (and re-scrapes) are cheap and never duplicate work; rows are
 * upserted with `ignoreDuplicates` as a belt-and-suspenders guard against the
 * unique (lab_test_id, biomarker_id) constraint. Never throws.
 *
 * Progress is reported through `onLog` (counts only — never secrets).
 */
export async function linkLabTestBiomarkers({
  labId,
  onlyUnlinked = true,
  onLog,
}: LinkBiomarkersArgs): Promise<LinkBiomarkersResult> {
  const empty: LinkBiomarkersResult = {
    testsConsidered: 0,
    testsLinked: 0,
    linksInserted: 0,
  }

  // Catalogue: active biomarkers only. Empty catalogue → nothing to match
  // (and matchTestsToBiomarkers short-circuits before any LLM call).
  const { data: catalogRows, error: catalogError } = await supabaseAdmin
    .from('biomarkers')
    .select('id, name, short_name, aliases, parent_id, variant_name')
    .is('archived_at', null)
  if (catalogError) {
    console.error('linkLabTestBiomarkers: catalog query failed', catalogError.message)
    onLog?.('Biomarker linking skipped: could not load catalogue')
    return empty
  }
  const catalog = (catalogRows ?? []) as CatalogBiomarker[]
  if (catalog.length === 0) {
    onLog?.('Biomarker linking skipped: empty catalogue')
    return empty
  }

  // Lab tests + whether they already have a link. The nested select returns an
  // array per test; an empty array means "no links yet".
  const { data: testRows, error: testsError } = await supabaseAdmin
    .from('lab_tests')
    .select('id, name, lab_test_biomarkers(biomarker_id)')
    .eq('lab_id', labId)
  if (testsError) {
    console.error('linkLabTestBiomarkers: tests query failed', testsError.message)
    onLog?.('Biomarker linking skipped: could not load tests')
    return empty
  }

  const allTests = testRows ?? []
  const tests = allTests.filter((t) => {
    if (!t.name || t.name.trim().length === 0) return false
    if (!onlyUnlinked) return true
    return (t.lab_test_biomarkers?.length ?? 0) === 0
  })

  if (tests.length === 0) {
    onLog?.('Biomarker linking: no tests to match')
    return empty
  }

  const names = tests.map((t) => t.name as string)
  const matchesByName = await matchTestsToBiomarkers(names, catalog, onLog)

  // Build link rows from the matches, keyed back to each test by name.
  const rows: { lab_test_id: string; biomarker_id: string }[] = []
  let testsLinked = 0
  for (const t of tests) {
    const ids = matchesByName.get((t.name as string).toLowerCase().trim())
    if (!ids || ids.length === 0) continue
    testsLinked++
    for (const biomarker_id of ids) {
      rows.push({ lab_test_id: t.id, biomarker_id })
    }
  }

  let linksInserted = 0
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const batch = rows.slice(i, i + INSERT_BATCH)
    const { error: insertError } = await supabaseAdmin
      .from('lab_test_biomarkers')
      .upsert(batch, {
        onConflict: 'lab_test_id,biomarker_id',
        ignoreDuplicates: true,
      })
    if (insertError) {
      console.error('linkLabTestBiomarkers: link insert failed', insertError.message)
      onLog?.(`Biomarker link insert failed: ${insertError.message}`)
    } else {
      linksInserted += batch.length
    }
  }

  onLog?.(
    `Linked ${testsLinked}/${tests.length} test(s) to ${linksInserted} biomarker(s)`
  )
  return { testsConsidered: tests.length, testsLinked, linksInserted }
}
