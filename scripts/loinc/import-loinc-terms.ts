/**
 * AUT-904 (v2) — Import the official LOINC release into public.loinc_terms.
 * Reads the full Loinc.csv (default /tmp/loinc-import/Loinc.csv), selects the axis
 * + name + unit columns, and upserts in batches via the service-role client.
 *   set -a; source .env.local; set +a; npx tsx scripts/loinc/import-loinc-terms.ts [csvPath]
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
const CSV = process.argv[2] ?? '/tmp/loinc-import/Loinc.csv'

/** RFC4180 parser (handles quoted fields, commas + newlines inside quotes, "" escapes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c === '\r') { /* skip */ }
    else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

const WANT: Record<string, string> = {
  LOINC_NUM: 'loinc_num', COMPONENT: 'component', PROPERTY: 'property', TIME_ASPCT: 'time_aspct',
  SYSTEM: 'system', SCALE_TYP: 'scale_typ', METHOD_TYP: 'method_typ', CLASS: 'class',
  CLASSTYPE: 'classtype', STATUS: 'status', EXAMPLE_UCUM_UNITS: 'example_ucum_units',
  LONG_COMMON_NAME: 'long_common_name', SHORTNAME: 'short_name', VersionLastChanged: 'version_last_changed',
}

async function main() {
  console.log(`parsing ${CSV} …`)
  const rows = parseCsv(readFileSync(CSV, 'utf8'))
  const header = rows[0]
  const idx: Record<string, number> = {}
  for (const [csvCol, col] of Object.entries(WANT)) {
    const at = header.indexOf(csvCol)
    if (at === -1) throw new Error(`column ${csvCol} not found in CSV header`)
    idx[col] = at
  }
  const records = rows.slice(1).filter((r) => r[idx.loinc_num]).map((r) => {
    const o: Record<string, string | number | null> = {}
    for (const col of Object.values(WANT)) {
      const v = r[idx[col]] ?? ''
      o[col] = col === 'classtype' ? (v ? Number(v) : null) : (v === '' ? null : v)
    }
    return o
  })
  console.log(`parsed ${records.length} LOINC terms; upserting …`)

  const BATCH = 2000
  for (let i = 0; i < records.length; i += BATCH) {
    const slice = records.slice(i, i + BATCH)
    const { error } = await db.from('loinc_terms').upsert(slice, { onConflict: 'loinc_num' })
    if (error) throw new Error(`batch ${i}-${i + slice.length}: ${error.message}`)
    if (i % 20000 === 0) console.log(`  …${i}`)
  }
  const { count } = await db.from('loinc_terms').select('*', { count: 'exact', head: true })
  console.log(`done. loinc_terms rows: ${count}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
