/**
 * Generate clean_name + abbreviation per LOINC code with the app's FAST_MODEL
 * (src/lib/ai/models.ts), into public.loinc_display. Default run = the codes our biomarkers map to
 * (so the review sheet is covered); `--all-lab` = every ACTIVE lab term
 * (classtype = 1) — the long tail, so unmatched markers in future imports get a
 * clean name instead of the raw LOINC string. Idempotent (skips codes already
 * generated), so it can be interrupted and re-run.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and ANTHROPIC_API_KEY from
 * .env.local (variables already set in the shell win).
 *   npx tsx scripts/loinc/gen-loinc-display.ts [--all-lab]
 */
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

import { FAST_MODEL, FAST_THINKING } from '../../src/lib/ai/models'

try {
  process.loadEnvFile('.env.local')
} catch {
  // no .env.local: rely on the environment
}

const MODEL = FAST_MODEL
const BATCH = 25

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Term { loinc_num: string; long_common_name: string; component: string; short_name: string | null }

const PROMPT = `You name clinical lab tests for a consumer health app. For each LOINC term below, return:
- "clean_name": a concise, human-friendly display name. Drop the specimen/property/method noise. KEEP common consumer abbreviations people recognise (T3, T4, LDL, HDL, HbA1c, DHEA-S, CRP, TSH). Prefer the familiar ordering, e.g. "Triiodothyronine (T3) Free [Mass/volume] in Serum or Plasma" -> "Free T3"; "Cholesterol in LDL ..." -> "LDL Cholesterol"; "Bilirubin.total ..." -> "Total Bilirubin".
- "abbreviation": a short symbol clinicians/labs use (FT3, FT4, ALT, AST, HbA1c, LDL, TSH, ALP, GGT). Use "" if there is no well-established short form.
Return ONLY a JSON array of {"loinc_num","clean_name","abbreviation"} — no prose, no markdown fences.`

function parseJsonArray(text: string): { loinc_num: string; clean_name: string; abbreviation: string }[] {
  const s = text.indexOf('['), e = text.lastIndexOf(']')
  if (s === -1 || e === -1) throw new Error('no JSON array in model output')
  return JSON.parse(text.slice(s, e + 1))
}

/** Page through a loinc_num-only select (PostgREST caps un-ranged reads at 1000 rows). */
async function fetchAllLoincNums(
  build: (from: number, to: number) => PromiseLike<{ data: { loinc_num: string }[] | null; error: { message: string } | null }>,
): Promise<string[]> {
  const PAGE = 1000
  const all: string[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    all.push(...(data ?? []).map((r) => r.loinc_num))
    if (!data || data.length < PAGE) break
  }
  return all
}

async function generatedCodes(): Promise<Set<string>> {
  // skip codes already generated (idempotent)
  return new Set(
    await fetchAllLoincNums((from, to) =>
      db.from('loinc_display').select('loinc_num').order('loinc_num').range(from, to),
    ),
  )
}

async function selectCodes(): Promise<string[]> {
  // Catalog-driven: every LOINC code the live (non-archived) catalog actually uses.
  const { data: bm, error } = await db
    .from('biomarkers').select('loinc_code').is('archived_at', null).not('loinc_code', 'is', null)
  if (error) throw new Error(error.message)
  const codes = new Set((bm as { loinc_code: string }[]).map((r) => r.loinc_code))
  const done = await generatedCodes()
  return [...codes].filter((c) => !done.has(c))
}

async function selectAllLabCodes(): Promise<string[]> {
  // Long tail: every ACTIVE laboratory term (classtype = 1) in the LOINC release.
  const all = await fetchAllLoincNums((from, to) =>
    db
      .from('loinc_terms')
      .select('loinc_num')
      .eq('classtype', 1)
      .eq('status', 'ACTIVE')
      .order('loinc_num')
      .range(from, to),
  )
  const done = await generatedCodes()
  return all.filter((c) => !done.has(c))
}

async function main() {
  const allLab = process.argv.includes('--all-lab')
  const codes = allLab ? await selectAllLabCodes() : await selectCodes()
  console.log(`generating display for ${codes.length} LOINC codes via ${MODEL}${allLab ? ' (all lab-active)' : ''} …`)
  for (let i = 0; i < codes.length; i += BATCH) {
    const batch = codes.slice(i, i + BATCH)
    const { data: terms, error } = await db
      .from('loinc_terms').select('loinc_num, long_common_name, component, short_name').in('loinc_num', batch)
    if (error) throw new Error(error.message)
    const input = (terms as Term[]).map((t) => ({ loinc_num: t.loinc_num, long_common_name: t.long_common_name, component: t.component, short_name: t.short_name }))
    const resp = await ai.messages.create({
      model: MODEL, max_tokens: 4096, thinking: FAST_THINKING,
      messages: [{ role: 'user', content: `${PROMPT}\n\nTERMS:\n${JSON.stringify(input)}` }],
    })
    const textBlock = resp.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('no text from model')
    const out = parseJsonArray(textBlock.text)
    // Only accept codes we actually sent — the model occasionally mangles a
    // loinc_num, and one bad code FK-fails the whole batch upsert.
    const sent = new Set(batch)
    const dropped = out.filter((o) => o.loinc_num && !sent.has(o.loinc_num))
    if (dropped.length) console.warn(`  ! dropped ${dropped.length} hallucinated code(s): ${dropped.map((o) => o.loinc_num).join(', ')}`)
    const rows = out
      .filter((o) => o.loinc_num && sent.has(o.loinc_num))
      .map((o) => ({ loinc_num: o.loinc_num, clean_name: o.clean_name ?? null, abbreviation: o.abbreviation || null, model: MODEL }))
    const { error: upErr } = await db.from('loinc_display').upsert(rows, { onConflict: 'loinc_num' })
    if (upErr) throw new Error(upErr.message)
    console.log(`  ${Math.min(i + BATCH, codes.length)}/${codes.length}`)
    await sleep(200)
  }
  const { count } = await db.from('loinc_display').select('*', { count: 'exact', head: true })
  console.log(`done. loinc_display rows: ${count}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
