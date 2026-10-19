/**
 * Build src/lib/units/data/loinc-molar-masses.json from an official LOINC release.
 *
 * For every active quantitative LOINC code that measures a mass or a molar
 * concentration (PROPERTY MCnc / SCnc, or EntMCnc / EntSCnc within a cell), it finds the code's base substance
 * (the "analyte-core" part, so "Glucose^1H post meal" and "Cholesterol.in HDL"
 * resolve to glucose and cholesterol), follows LOINC's own link from that part
 * to ChEBI (or PubChem), and records the substance's average molar mass and
 * charge. Curated values (src/lib/units/curated-analytes.ts) win over looked-up
 * ones: proteins, reporting conventions (triglycerides as triolein, phosphate
 * as phosphorus, urea nitrogen as N2) and anything ChEBI has no mass for.
 *
 *   npx tsx scripts/units/build-molar-masses.ts <path/to/Loinc_2.xx>
 *
 * Looked-up masses are cached in scripts/units/.cache/ so a rerun is fast.
 * Sources: LOINC (Regenstrief Institute, https://loinc.org), ChEBI (EMBL-EBI,
 * CC BY 4.0), PubChem (NCBI, public domain).
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

import { CURATED_ANALYTES } from '../../src/lib/units/curated-analytes'

const ROOT = process.argv[2]
if (!ROOT) throw new Error('usage: build-molar-masses.ts <path/to/Loinc_2.xx>')
const PART_DIR = join(ROOT, 'AccessoryFiles', 'PartFile')
const CACHE_DIR = join(__dirname, '.cache')
const OUT = join(__dirname, '..', '..', 'src', 'lib', 'units', 'data', 'loinc-molar-masses.json')

/** One CSV line (RFC 4180, no embedded newlines in these files). */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { out.push(field); field = '' }
    else field += c
  }
  out.push(field)
  return out
}

async function eachRow(path: string, fn: (row: Record<string, string>) => void): Promise<void> {
  const rl = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity })
  let header: string[] | null = null
  let pending = ''
  for await (const raw of rl) {
    // Loinc.csv has a few quoted fields with newlines: join until quotes balance.
    const line = pending ? `${pending}\n${raw}` : raw
    if ((line.match(/"/g)?.length ?? 0) % 2 === 1) { pending = line; continue }
    pending = ''
    const cells = splitCsvLine(line)
    if (!header) { header = cells; continue }
    const row: Record<string, string> = {}
    header.forEach((h, i) => { row[h] = cells[i] ?? '' })
    fn(row)
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, init)
    if (res.ok) return res.json()
    if (res.status === 404) return null
    await sleep(1000 * (attempt + 1))
  }
  throw new Error(`fetch failed: ${url}`)
}

interface Looked { mass: number | null; charge: number | null; name: string | null }

function loadCache(name: string): Record<string, Looked> {
  const p = join(CACHE_DIR, name)
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {}
}
function saveCache(name: string, data: Record<string, Looked>): void {
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(join(CACHE_DIR, name), JSON.stringify(data))
}

async function lookupChebi(ids: string[]): Promise<Record<string, Looked>> {
  const cache = loadCache('chebi.json')
  const todo = ids.filter((id) => !(id in cache))
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50).map((id) => id.replace(/^CHEBI:/, ''))
    const data = (await fetchJson(
      `https://www.ebi.ac.uk/chebi/backend/api/public/compounds/?chebi_ids=${batch.join(',')}`
    )) as Record<string, { data?: { name?: string; chemical_data?: { mass?: string | null; charge?: number | null } } }> | null
    for (const id of batch) {
      const d = data?.[id]?.data
      const mass = d?.chemical_data?.mass ? Number(d.chemical_data.mass) : null
      cache[`CHEBI:${id}`] = {
        mass: mass && Number.isFinite(mass) ? mass : null,
        charge: d?.chemical_data?.charge ?? null,
        name: d?.name ?? null,
      }
    }
    saveCache('chebi.json', cache)
    process.stdout.write(`\r  ChEBI ${Math.min(i + 50, todo.length)}/${todo.length}`)
    await sleep(300)
  }
  if (todo.length) process.stdout.write('\n')
  return cache
}

async function lookupPubchem(cids: string[]): Promise<Record<string, Looked>> {
  const cache = loadCache('pubchem.json')
  const todo = cids.filter((id) => !(id in cache))
  for (let i = 0; i < todo.length; i += 100) {
    const batch = todo.slice(i, i + 100)
    const data = (await fetchJson(
      'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/property/MolecularWeight,Charge,Title/JSON',
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `cid=${batch.join(',')}` }
    )) as { PropertyTable?: { Properties?: Array<{ CID: number; MolecularWeight?: string; Charge?: number; Title?: string }> } } | null
    for (const p of data?.PropertyTable?.Properties ?? []) {
      cache[String(p.CID)] = { mass: p.MolecularWeight ? Number(p.MolecularWeight) : null, charge: p.Charge ?? null, name: p.Title ?? null }
    }
    for (const id of batch) cache[id] ??= { mass: null, charge: null, name: null }
    saveCache('pubchem.json', cache)
    await sleep(250)
  }
  return cache
}

interface AnalyteOut {
  name: string
  /** Average molar mass in g/mol. */
  molarMass: number
  /** Charge number for mEq ↔ mmol (only for ions). */
  valence?: number
  source: string
}

async function main() {
  console.log('reading Loinc.csv …')
  const codes = new Map<string, { property: string; component: string; unit: string; blood: boolean }>()
  await eachRow(join(ROOT, 'LoincTable', 'Loinc.csv'), (r) => {
    if (r.STATUS !== 'ACTIVE' || r.SCALE_TYP !== 'Qn') return
    // EntMCnc / EntSCnc: concentration within a cell (MCHC in g/dL or mmol/L).
    const property = r.PROPERTY.replace(/^Ent/, '')
    if (property !== 'MCnc' && property !== 'SCnc') return
    codes.set(r.LOINC_NUM, {
      property,
      component: r.COMPONENT,
      unit: (r.EXAMPLE_UCUM_UNITS ?? '').split(';')[0].trim(),
      blood: /^(Ser|Plas|Bld|RBC)/.test(r.SYSTEM),
    })
  })
  console.log(`  ${codes.size} mass / molar concentration codes`)

  console.log('reading analyte links …')
  const core = new Map<string, { part: string; name: string }>()
  await eachRow(join(PART_DIR, 'LoincPartLink_Supplementary.csv'), (r) => {
    if (r.Property !== 'http://loinc.org/property/analyte-core') return
    if (codes.has(r.LoincNumber)) core.set(r.LoincNumber, { part: r.PartNumber, name: r.PartName })
  })

  const ext = new Map<string, { chebi?: string; pubchem?: string }>()
  await eachRow(join(PART_DIR, 'PartRelatedCodeMapping.csv'), (r) => {
    if (r.PartTypeName !== 'COMPONENT' || r.Equivalence !== 'equivalent') return
    const e = ext.get(r.PartNumber) ?? {}
    if (r.ExtCodeSystem.includes('chebi')) e.chebi ??= r.ExtCodeId
    if (r.ExtCodeSystem.includes('pubchem')) e.pubchem ??= r.ExtCodeId
    ext.set(r.PartNumber, e)
  })

  const parts = new Map<string, string>()
  for (const { part, name } of core.values()) parts.set(part, name)
  console.log(`  ${parts.size} base substances`)

  const chebiIds = [...new Set([...parts.keys()].map((p) => ext.get(p)?.chebi).filter((x): x is string => !!x))]
  const cids = [...new Set([...parts.keys()].map((p) => ext.get(p)?.pubchem).filter((x): x is string => !!x))]
  console.log(`looking up ${chebiIds.length} ChEBI and ${cids.length} PubChem ids …`)
  const chebi = await lookupChebi(chebiIds)
  const pubchem = await lookupPubchem(cids)

  const analytes: Record<string, AnalyteOut> = {}
  const unresolved: string[] = []
  for (const [part, name] of parts) {
    const curated = CURATED_ANALYTES[name]
    if (curated === null) continue // deliberately not convertible
    if (curated) {
      analytes[part] = { name, molarMass: curated.molarMass, ...(curated.valence ? { valence: curated.valence } : {}), source: `curated: ${curated.basis}` }
      continue
    }
    const e = ext.get(part)
    const hit = (e?.chebi && chebi[e.chebi]?.mass ? { ...chebi[e.chebi], src: e.chebi } : null)
      ?? (e?.pubchem && pubchem[e.pubchem]?.mass ? { ...pubchem[e.pubchem], src: `PubChem CID ${e.pubchem}` } : null)
    if (!hit || !hit.mass) { unresolved.push(name); continue }
    const valence = hit.charge ? Math.abs(hit.charge) : 0
    analytes[part] = { name, molarMass: hit.mass, ...(valence ? { valence } : {}), source: hit.src }
  }

  const codeMap: Record<string, string> = {}
  for (const [loinc, { part }] of core) if (analytes[part]) codeMap[loinc] = part

  // The unit labs use most for each kind (mass / molar), from LOINC's example
  // units, blood codes first. The app offers it as an input unit.
  const tally = new Map<string, Map<string, number>>()
  for (const [loinc, { part }] of core) {
    const c = codes.get(loinc)
    if (!c || !analytes[part] || !c.unit || c.unit.includes('{') || c.unit.includes('[')) continue
    const key = `${part}|${c.property}`
    const t = tally.get(key) ?? new Map<string, number>()
    t.set(c.unit, (t.get(c.unit) ?? 0) + (c.blood ? 10 : 1))
    tally.set(key, t)
  }
  for (const [key, t] of tally) {
    const [part, property] = key.split('|')
    const best = [...t.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    if (!best) continue
    const a = analytes[part] as AnalyteOut & { massUnit?: string; molarUnit?: string }
    if (property === 'MCnc') a.massUnit = best
    else a.molarUnit = best
  }

  mkdirSync(join(OUT, '..'), { recursive: true })
  writeFileSync(
    OUT,
    JSON.stringify({
      source: `${ROOT.split('/').filter(Boolean).pop()}; molar masses from ChEBI (CC BY 4.0), PubChem and curated-analytes.ts`,
      analytes,
      codes: codeMap,
    })
  )
  writeFileSync(join(CACHE_DIR, 'unresolved.txt'), unresolved.sort().join('\n'))
  console.log(`wrote ${Object.keys(analytes).length} substances, ${Object.keys(codeMap).length} codes → ${OUT}`)
  console.log(`${unresolved.length} substances without a molar mass (scripts/units/.cache/unresolved.txt)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
