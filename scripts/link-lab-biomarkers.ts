/**
 * Backfill `lab_test_biomarkers` for a lab by LLM-matching its test names to the
 * biomarker catalogue (validated against the real catalogue — no hallucination).
 * The matching engine is shared with the scrape pipeline
 * (src/lib/labs/match-test-biomarkers.ts); DB plumbing is inlined here because
 * scripts can't use `@/` aliases.
 *
 * Usage (note: unset Claude Code's injected Anthropic env so the real key from
 * .env.local is used against the public API):
 *   env -u ANTHROPIC_BASE_URL -u ANTHROPIC_API_KEY \
 *     npx tsx scripts/link-lab-biomarkers.ts <labId> [--all]
 *
 *   --all   match every test (default: only tests with no links yet)
 */

import { createClient } from '@supabase/supabase-js'

try {
  process.loadEnvFile('.env.local')
} catch {
  // no .env.local: rely on the environment
}

const labId = process.argv[2]
const matchAll = process.argv.includes('--all')

if (!labId || labId.startsWith('--')) {
  console.error('Usage: npx tsx scripts/link-lab-biomarkers.ts <labId> [--all]')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const INSERT_BATCH = 500

// Local mirror of the engine's CatalogBiomarker shape (avoids a type-only import
// across the dynamic-import boundary).
interface CatalogBiomarker {
  id: string
  name: string
  short_name: string | null
  aliases: string[] | null
  parent_id: string | null
  variant_name: string | null
}

async function main() {
  // Import the engine AFTER .env.local is loaded so its Anthropic client gets a key.
  const { matchTestsToBiomarkers } = await import(
    '../src/lib/labs/match-test-biomarkers'
  )

  const { data: lab } = await supabase
    .from('labs')
    .select('id, name')
    .eq('id', labId)
    .maybeSingle()
  if (!lab) {
    console.error(`Lab ${labId} not found`)
    process.exit(1)
  }
  console.log(`Lab: ${lab.name} (${lab.id})`)

  const { data: catalogRows, error: catErr } = await supabase
    .from('biomarkers')
    .select('id, name, short_name, aliases, parent_id, variant_name')
    .is('archived_at', null)
  if (catErr) throw new Error(`catalog query failed: ${catErr.message}`)
  const catalog = (catalogRows ?? []) as CatalogBiomarker[]
  console.log(`Catalogue: ${catalog.length} active biomarkers`)

  const { data: testRows, error: testErr } = await supabase
    .from('lab_tests')
    .select('id, name, lab_test_biomarkers(biomarker_id)')
    .eq('lab_id', labId)
  if (testErr) throw new Error(`tests query failed: ${testErr.message}`)

  type TestRow = {
    id: string
    name: string | null
    lab_test_biomarkers: { biomarker_id: string }[] | null
  }
  const allTests = (testRows ?? []) as unknown as TestRow[]
  const tests = allTests.filter((t) => {
    if (!t.name || t.name.trim().length === 0) return false
    if (matchAll) return true
    return (t.lab_test_biomarkers?.length ?? 0) === 0
  })
  console.log(
    `Tests: ${allTests.length} total, ${tests.length} to match (${matchAll ? 'all' : 'unlinked only'})`
  )
  if (tests.length === 0) {
    console.log('Nothing to do.')
    return
  }

  const names = tests.map((t) => t.name as string)
  const matchesByName = await matchTestsToBiomarkers(names, catalog, (m) =>
    console.log(`  ${m}`)
  )

  const rows: { lab_test_id: string; biomarker_id: string }[] = []
  let testsLinked = 0
  for (const t of tests) {
    const ids = matchesByName.get((t.name as string).toLowerCase().trim())
    if (!ids || ids.length === 0) continue
    testsLinked++
    for (const biomarker_id of ids) rows.push({ lab_test_id: t.id, biomarker_id })
  }
  console.log(`Built ${rows.length} link row(s) across ${testsLinked} test(s)`)

  let inserted = 0
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const batch = rows.slice(i, i + INSERT_BATCH)
    const { error } = await supabase
      .from('lab_test_biomarkers')
      .upsert(batch, { onConflict: 'lab_test_id,biomarker_id', ignoreDuplicates: true })
    if (error) console.error(`  insert batch failed: ${error.message}`)
    else inserted += batch.length
  }
  console.log(`Done: inserted ${inserted} link row(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
