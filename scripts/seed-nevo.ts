/**
 * Seed the nevo_foods table from the RIVM NEVO 2025 CSV export.
 *
 * Usage (reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from .env.local):
 *   npx tsx scripts/seed-nevo.ts /path/to/NEVO2025_v9.0.csv        # dry run
 *   npx tsx scripts/seed-nevo.ts /path/to/NEVO2025_v9.0.csv --commit
 */
import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

import { parseNevoCsv } from '../src/lib/nutrition/nevo-csv'

try {
  process.loadEnvFile('.env.local')
} catch {
  // no .env.local: rely on the environment
}

const commit = process.argv.includes('--commit')

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return v
}

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: npx tsx scripts/seed-nevo.ts <path-to-csv> [--commit]')
  process.exit(1)
}

const text = readFileSync(filePath, 'utf8')
const rows = parseNevoCsv(text)
console.log(`parsed rows: ${rows.length}`)

if (!commit) {
  console.log('dry run — first 3 rows:')
  for (const row of rows.slice(0, 3)) {
    console.log(`  [${row.nevo_code}] ${row.name_nl} — ${row.kcal_per_100g} kcal`)
  }
  console.log('pass --commit to write to database')
  process.exit(0)
}

const supabase = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SECRET_KEY'))

async function main() {
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    // Omit search_text — it is a generated column
    const { error } = await supabase
      .from('nevo_foods')
      .upsert(chunk, { onConflict: 'nevo_code' })
    if (error) {
      console.error(`chunk ${i}–${i + chunk.length - 1} failed:`, error.message)
      process.exit(1)
    }
    console.log(`upserted ${Math.min(i + CHUNK, rows.length)}/${rows.length}`)
  }
  console.log('done')
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
