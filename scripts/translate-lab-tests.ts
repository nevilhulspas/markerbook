/**
 * Backfill: translate an already-scraped lab's test names / methods / sample
 * types to English, IN PLACE. New scrapes translate inline during extraction;
 * this fixes catalogues that were stored in the lab's native language (e.g. the
 * Bulgarian Lina catalogue) before that rule existed.
 *
 * In-place update (not re-scrape) is deliberate: an English name normalizes to a
 * different dedup key than its Cyrillic original, so re-scraping would duplicate
 * every test instead of replacing it.
 *
 * The translation engine is shared with the app (src/lib/labs/translate.ts); DB
 * plumbing is inlined here because scripts can't use `@/` aliases.
 *
 * Usage (note: unset Claude Code's injected Anthropic env so the real key from
 * .env.local is used against the public API):
 *   env -u ANTHROPIC_BASE_URL -u ANTHROPIC_API_KEY \
 *     npx tsx scripts/translate-lab-tests.ts <labId> [--all] [--dry-run]
 *
 *   --all       translate every field (default: only fields with non-Latin text)
 *   --dry-run   print what would change without writing
 *
 * After running, re-link biomarkers so the now-English names match the catalogue:
 *   env -u ANTHROPIC_BASE_URL -u ANTHROPIC_API_KEY \
 *     npx tsx scripts/link-lab-biomarkers.ts <labId>
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const labId = process.argv[2]
const translateAll = process.argv.includes('--all')
const dryRun = process.argv.includes('--dry-run')

if (!labId || labId.startsWith('--')) {
  console.error(
    'Usage: npx tsx scripts/translate-lab-tests.ts <labId> [--all] [--dry-run]'
  )
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type TestRow = {
  id: string
  name: string | null
  method: string | null
  sample_type: string | null
}

const FIELDS = ['name', 'method', 'sample_type'] as const

async function main() {
  // Import the engine AFTER dotenv so its top-level Anthropic client gets a key.
  const { translateToEnglish, needsTranslation } = await import(
    '../src/lib/labs/translate'
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

  const { data: testRows, error } = await supabase
    .from('lab_tests')
    .select('id, name, method, sample_type')
    .eq('lab_id', labId)
  if (error) throw new Error(`tests query failed: ${error.message}`)
  const tests = (testRows ?? []) as TestRow[]
  console.log(`Tests: ${tests.length}`)

  // Collect the set of distinct source strings to translate. Translating unique
  // strings (not per-row) keeps the call count down and stays consistent.
  const sources = new Set<string>()
  for (const t of tests) {
    for (const field of FIELDS) {
      const value = t[field]
      if (!value) continue
      if (translateAll || needsTranslation(value)) sources.add(value)
    }
  }
  const toTranslate = [...sources]
  console.log(`Distinct strings to translate: ${toTranslate.length}`)
  if (toTranslate.length === 0) {
    console.log('Nothing to do.')
    return
  }

  const translated = await translateToEnglish(toTranslate, (m) => console.log(`  ${m}`))
  const map = new Map<string, string>()
  toTranslate.forEach((src, i) => {
    const en = translated[i]?.trim()
    if (en && en !== src) map.set(src, en)
  })
  console.log(`Strings that changed: ${map.size}`)

  let updated = 0
  for (const t of tests) {
    const patch: Partial<TestRow> = {}
    for (const field of FIELDS) {
      const value = t[field]
      if (value && map.has(value)) patch[field] = map.get(value)!
    }
    if (Object.keys(patch).length === 0) continue

    if (dryRun) {
      console.log(`  [dry] ${t.name} → ${patch.name ?? t.name}`)
      updated++
      continue
    }
    const { error: upErr } = await supabase
      .from('lab_tests')
      .update(patch)
      .eq('id', t.id)
    if (upErr) console.error(`  update ${t.id} failed: ${upErr.message}`)
    else updated++
  }
  console.log(
    dryRun ? `Done (dry-run): ${updated} row(s) would change.` : `Done: updated ${updated} row(s).`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
