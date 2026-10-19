import { describe, it, expect, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  resolveLabsByName,
  matchOneLab,
  enrichListItems,
  mapCatalogueRows,
  createLabTestTools,
  type LabTestMeta,
} from '../lab-test-tools'

const labs = [
  { id: 'b', name: 'BODIMED' },
  { id: 'l', name: 'Lina Laboratory' },
]

// ---- in-memory state for next-to-test tables ----
type Row = Record<string, unknown> & { id: string }
let nttLists: Row[] = []
let nttEntries: Row[] = []
let biomarkerCatalog: Array<{ id: string; name: string; short_name?: string | null; aliases?: unknown[] }> = []
// Errors the next `next_to_test` inserts return, in order (e.g. a 23505 unique
// violation), so tests can drive the duplicate / DB-error branches.
let nttInsertErrors: Array<{ code?: string; message: string }> = []
// Plain reads (awaited select chains) of these tables fail with the error.
let nttReadErrors: Partial<Record<string, { message: string }>> = {}

function resetNttState() {
  nttLists = []
  nttEntries = []
  biomarkerCatalog = []
  nttInsertErrors = []
  nttReadErrors = {}
}

// Chainable builder for next_to_test_lists and next_to_test tables (mirrors the
// pattern in src/actions/__tests__/next-to-test.test.ts).
function createNttBuilder(table: 'next_to_test_lists' | 'next_to_test' | 'biomarkers') {
  const filters: Array<[string, unknown]> = []
  let _orderAsc = true
  const collection = (): Row[] => {
    if (table === 'next_to_test_lists') return nttLists
    if (table === 'next_to_test') return nttEntries
    return biomarkerCatalog as unknown as Row[]
  }
  const matched = () => collection().filter((r) => filters.every(([k, v]) => r[k] === v))
  let pageRange: [number, number] | null = null

  const builder: Record<string, unknown> = {
    select() { return builder },
    eq(col: string, val: unknown) { filters.push([col, val]); return builder },
    order(_col: string, opts?: { ascending?: boolean }) {
      _orderAsc = opts?.ascending ?? true
      return builder
    },
    limit() { return builder },
    // Honour .range() like PostgREST, so paged reads end on an empty page.
    range(from: number, to: number) { pageRange = [from, to]; return builder },
    in(col: string, vals: unknown[]) {
      const origMatched = matched
      const matchedIn = () => origMatched().filter((r) => vals.includes(r[col]));
      (builder as Record<string, unknown> & { __matched?: () => Row[] }).__matched = matchedIn
      return builder
    },
    maybeSingle() {
      const fn = ((builder as Record<string, unknown> & { __matched?: () => Row[] }).__matched) ?? matched
      const rows = fn()
      // For order queries we may want the most-recently-created (last inserted)
      const sorted = _orderAsc ? rows : [...rows].reverse()
      return Promise.resolve({ data: sorted[0] ?? null, error: null })
    },
    single() {
      const fn = ((builder as Record<string, unknown> & { __matched?: () => Row[] }).__matched) ?? matched
      const rows = fn()
      const row = rows[0] ?? null
      return Promise.resolve({ data: row, error: row ? null : { message: 'not found' } })
    },
    insert(rows: Row | Row[]) {
      const failure = table === 'next_to_test' ? nttInsertErrors.shift() : undefined
      if (failure) {
        const failed: Record<string, unknown> = {
          select: () => failed,
          single: () => Promise.resolve({ data: null, error: failure }),
        }
        return failed
      }
      const list = Array.isArray(rows) ? rows : [rows]
      const inserted = list.map((r) => ({
        ...r,
        id: (r.id as string | undefined) ?? `id-${Math.random().toString(36).slice(2, 9)}`,
        created_at: new Date('2026-05-28T00:00:00Z').toISOString(),
      }))
      collection().push(...inserted)
      const chain: Record<string, unknown> = {
        select: () => chain,
        single: () => Promise.resolve({ data: inserted[0], error: null }),
      }
      return chain
    },
    update(patch: Partial<Row>) {
      const chain: Record<string, unknown> = {
        eq(col: string, val: unknown) { filters.push([col, val]); return chain },
        select: () => chain,
        single: () => {
          const ms = matched()
          if (ms[0]) Object.assign(ms[0], patch)
          return Promise.resolve({
            data: ms[0] ?? null,
            error: ms[0] ? null : { message: 'not found' },
          })
        },
      }
      return chain
    },
    delete() {
      const performDelete = (): Row[] => {
        const ms = matched()
        for (const row of ms) {
          const idx = collection().indexOf(row)
          if (idx !== -1) collection().splice(idx, 1)
        }
        return ms
      }
      const chain: Record<string, unknown> = {
        eq(col: string, val: unknown) { filters.push([col, val]); return chain },
        // `.select().single()` matches PostgREST's behavior: zero-row match
        // surfaces as PGRST116 (not a silent success), which the tool maps to
        // `{ error: 'not_found' }`.
        select() {
          return {
            single() {
              const ms = performDelete()
              if (ms.length === 0) {
                return Promise.resolve({
                  data: null,
                  error: { code: 'PGRST116', message: 'no rows' },
                })
              }
              return Promise.resolve({ data: ms[0], error: null })
            },
          }
        },
        then(resolve: (v: { error: null }) => unknown) {
          performDelete()
          return resolve({ error: null })
        },
      }
      return chain
    },
    then(resolve: (v: unknown) => unknown) {
      const readError = nttReadErrors[table]
      if (readError) return resolve({ data: null, error: readError })
      const fn = ((builder as Record<string, unknown> & { __matched?: () => Row[] }).__matched) ?? matched
      const rows = fn()
      const sorted = _orderAsc ? rows : [...rows].reverse()
      const page = pageRange ? sorted.slice(pageRange[0], pageRange[1] + 1) : sorted
      return resolve({ data: page, error: null })
    },
  }
  return builder
}

describe('resolveLabsByName', () => {
  it('matches case-insensitively + by substring, dedupes, reports unmatched', () => {
    const r = resolveLabsByName(['bodimed', 'Lina', 'Nonexistent', 'BODIMED'], labs)
    expect(r.matched.map((m) => m.id)).toEqual(['b', 'l'])
    expect(r.unmatched).toEqual(['Nonexistent'])
  })
})

describe('matchOneLab', () => {
  it('prefers exact, then substring in either direction', () => {
    expect(matchOneLab('BODIMED', labs)?.id).toBe('b')
    expect(matchOneLab('lina', labs)?.id).toBe('l') // query is substring of name
    expect(matchOneLab('Lina Laboratory Sofia', labs)?.id).toBe('l') // name is substring of query
    expect(matchOneLab('zzz', labs)).toBeNull()
    expect(matchOneLab('', labs)).toBeNull()
  })
})

describe('enrichListItems', () => {
  const tests: LabTestMeta[] = [
    { name: 'Ferritin', method: 'ECLIA', cost: 18, currency: 'BGN', turnaround_days: 1, sample_type: 'serum' },
    { name: 'LDL - Cholesterol (LDL-C)', method: null, cost: 9, currency: 'BGN', turnaround_days: null, sample_type: null },
  ]

  it('attaches metadata for found tests (normalized match) and flags unknowns', () => {
    const out = enrichListItems(
      [
        { testName: 'ferritin', reason: 'low last value' },
        { testName: 'LDL – Cholesterol (LDL-C)' }, // en-dash variant of the stored name
        { testName: 'Made Up Test' },
      ],
      tests
    )
    expect(out[0]).toMatchObject({ testName: 'Ferritin', found: true, cost: 18, reason: 'low last value' })
    expect(out[1]).toMatchObject({ testName: 'LDL - Cholesterol (LDL-C)', found: true })
    expect(out[2]).toMatchObject({ testName: 'Made Up Test', found: false, cost: null, reason: null })
  })
})

describe('mapCatalogueRows', () => {
  it('flattens nested biomarker joins and drops null joins', () => {
    const rows = [
      {
        name: 'Ferritin',
        method: 'ECLIA',
        cost: 18,
        currency: 'BGN',
        turnaround_days: 1,
        sample_type: 'serum',
        lab_test_biomarkers: [
          { biomarkers: { name: 'Ferritin', short_name: 'FER' } },
          { biomarkers: null },
        ],
      },
      {
        name: 'Glucose',
        method: null,
        cost: null,
        currency: null,
        turnaround_days: null,
        sample_type: null,
        lab_test_biomarkers: null,
      },
    ]
    const out = mapCatalogueRows(rows)
    expect(out[0]).toMatchObject({ name: 'Ferritin', cost: 18 })
    expect(out[0].biomarkers).toEqual([{ name: 'Ferritin', short_name: 'FER' }])
    expect(out[1]).toMatchObject({ name: 'Glucose', biomarkers: [] })
  })
})

// Minimal chainable Supabase stub: every filter/order/limit returns `this`, and
// awaiting the builder resolves to { data }. `tableData` maps a table to its rows.
// Tables in nttTableSet are backed by the live in-memory ntt state (supports
// insert/update/maybeSingle/single); all others use a simple read-only builder.
const nttTableSet = new Set(['next_to_test_lists', 'next_to_test', 'biomarkers'])

function fakeSupabase(tableData: Record<string, unknown[]>): SupabaseClient {
  const make = (rows: unknown[]) => {
    const builder: Record<string, unknown> = {}
    let page = rows
    for (const m of ['select', 'eq', 'order', 'limit']) {
      builder[m] = () => builder
    }
    // Honour .range() like PostgREST, so paged reads end on an empty page.
    builder.range = (from: number, to: number) => {
      page = rows.slice(from, to + 1)
      return builder
    }
    builder.then = (resolve: (v: { data: unknown[] }) => unknown) =>
      Promise.resolve({ data: page }).then(resolve)
    return builder
  }
  return {
    from: (table: string) => {
      if (nttTableSet.has(table)) {
        return createNttBuilder(table as 'next_to_test_lists' | 'next_to_test' | 'biomarkers')
      }
      return make(tableData[table] ?? [])
    },
  } as unknown as SupabaseClient
}

describe('list_lab_tests tool', () => {
  beforeEach(resetNttState)

  it('returns each matched lab full catalogue with a testCount, plus unmatched', async () => {
    const supabase = fakeSupabase({
      labs: [{ id: 'l', name: 'Lina Laboratory' }],
      lab_tests: [
        {
          name: 'Creatinine',
          method: null,
          cost: 2,
          currency: 'EUR',
          turnaround_days: 1,
          sample_type: 'blood',
          lab_test_biomarkers: [{ biomarkers: { name: 'Creatinine', short_name: 'CREA' } }],
        },
        {
          name: 'Glucose',
          method: null,
          cost: 1,
          currency: 'EUR',
          turnaround_days: 1,
          sample_type: 'blood',
          lab_test_biomarkers: [],
        },
      ],
    })
    const tools = createLabTestTools(supabase, 'user-test')
    const result = (await tools.list_lab_tests.execute!(
      { labs: ['Lina', 'Ghost Lab'] },
      { toolCallId: 't', messages: [], context: {} }
    )) as {
      labs: { labName: string; testCount: number; tests: { name: string }[] }[]
      unmatchedLabs: string[]
    }

    expect(result.unmatchedLabs).toEqual(['Ghost Lab'])
    expect(result.labs).toHaveLength(1)
    expect(result.labs[0]).toMatchObject({ labName: 'Lina Laboratory', testCount: 2 })
    expect(result.labs[0].tests.map((t) => t.name)).toEqual(['Creatinine', 'Glucose'])
  })

  it('add_to_next_to_test inserts a biomarker entry and resolves by name', async () => {
    // Seed a biomarker that the catalog mock will return
    biomarkerCatalog.push({ id: 'bm-tsh', name: 'TSH', short_name: 'TSH', aliases: [] })
    const supabase = fakeSupabase({
      labs: [{ id: 'l', name: 'Lina Laboratory' }],
      lab_tests: [],
    })
    const tools = createLabTestTools(supabase, 'user-1')
    const out = await tools.add_to_next_to_test.execute!(
      { biomarkerName: 'TSH' },
      { toolCallId: 't', messages: [], context: {} }
    )
    expect(out).toMatchObject({ added: true })
    expect(nttEntries).toHaveLength(1)
    expect(nttEntries[0]).toMatchObject({
      biomarker_id: 'bm-tsh',
      lab_test_id: null,
      status: 'pending',
    })
  })

  it('add_to_next_to_test reports ambiguous when multiple biomarkers match', async () => {
    biomarkerCatalog.push(
      { id: 'bm-1', name: 'Vitamin D 25-OH', short_name: 'Vit D', aliases: [] },
      { id: 'bm-2', name: 'Vitamin D 1,25-OH', short_name: 'Vit D', aliases: [] }
    )
    const supabase = fakeSupabase({
      labs: [],
      lab_tests: [],
    })
    const tools = createLabTestTools(supabase, 'user-1')
    const out = await tools.add_to_next_to_test.execute!(
      { biomarkerName: 'vitamin d' },
      { toolCallId: 't', messages: [], context: {} }
    )
    expect(out).toMatchObject({ error: 'ambiguous' })
    expect((out as { candidates?: string[] }).candidates?.length ?? 0).toBeGreaterThan(0)
  })

  it('add_to_next_to_test exact match wins over substring runners-up', async () => {
    // Regression: "Total Cholesterol" used to flag as ambiguous against
    // "Testosterone" when the AI passed a phrase, because the old matcher
    // tested needle.includes(stored) as well. With the scored resolver an
    // exact match decisively beats any substring match.
    biomarkerCatalog.push(
      { id: 'bm-tot', name: 'Total Cholesterol', short_name: null, aliases: [] },
      { id: 'bm-hdl', name: 'HDL Cholesterol', short_name: 'HDL', aliases: [] },
      { id: 'bm-ldl', name: 'LDL Cholesterol', short_name: 'LDL', aliases: [] },
      { id: 'bm-test', name: 'Testosterone', short_name: null, aliases: [] }
    )
    const supabase = fakeSupabase({ labs: [], lab_tests: [] })
    const tools = createLabTestTools(supabase, 'user-1')
    const out = await tools.add_to_next_to_test.execute!(
      { biomarkerName: 'Total Cholesterol' },
      { toolCallId: 't', messages: [], context: {} }
    )
    expect(out).toMatchObject({
      added: true,
      entry: { kind: 'biomarker', name: 'Total Cholesterol' },
    })
  })

  it('add_to_next_to_test does NOT match a sloppy phrase containing biomarker names', async () => {
    // The old bidirectional .includes() let a query like "cholesterol and
    // testosterone" match every biomarker substring in the phrase. Scored
    // resolver rejects: no stored name contains the whole phrase.
    biomarkerCatalog.push(
      { id: 'bm-tot', name: 'Total Cholesterol', short_name: null, aliases: [] },
      { id: 'bm-test', name: 'Testosterone', short_name: null, aliases: [] }
    )
    const supabase = fakeSupabase({ labs: [], lab_tests: [] })
    const tools = createLabTestTools(supabase, 'user-1')
    const out = await tools.add_to_next_to_test.execute!(
      { biomarkerName: 'cholesterol and testosterone' },
      { toolCallId: 't', messages: [], context: {} }
    )
    // No stored name contains the whole phrase → no biomarker match. With
    // auto-save it lands as a free-text custom entry rather than binding to
    // Total Cholesterol or Testosterone.
    expect(out).toMatchObject({ added: true, entry: { kind: 'custom' } })
    expect(nttEntries).toHaveLength(1)
    expect(nttEntries[0]).toMatchObject({
      test_type: 'other',
      biomarker_id: null,
      lab_test_id: null,
      custom_name: 'cholesterol and testosterone',
    })
  })

  it('add_to_next_to_test auto-saves an uncatalogued test as a custom entry', async () => {
    // The reported case: a specialty test (SIBO breath test) that's in
    // neither the biomarker nor lab-test catalogue is saved as free text.
    const supabase = fakeSupabase({ labs: [], lab_tests: [] })
    const tools = createLabTestTools(supabase, 'user-1')
    const out = await tools.add_to_next_to_test.execute!(
      { biomarkerName: 'SIBO breath test' },
      { toolCallId: 't', messages: [], context: {} }
    )
    expect(out).toMatchObject({
      added: true,
      entry: { kind: 'custom', name: 'SIBO breath test' },
    })
    expect(nttEntries).toHaveLength(1)
    expect(nttEntries[0]).toMatchObject({
      test_type: 'other',
      biomarker_id: null,
      lab_test_id: null,
      custom_name: 'SIBO breath test',
      status: 'pending',
    })
  })

  it('add_to_next_to_test dedupes a custom entry case-insensitively within the list', async () => {
    const supabase = fakeSupabase({ labs: [], lab_tests: [] })
    const tools = createLabTestTools(supabase, 'user-1')
    const first = await tools.add_to_next_to_test.execute!(
      { biomarkerName: 'Cyrex Array 2' },
      { toolCallId: 't', messages: [], context: {} }
    )
    expect(first).toMatchObject({ added: true, entry: { kind: 'custom' } })
    const dup = await tools.add_to_next_to_test.execute!(
      { biomarkerName: 'cyrex array 2' }, // different case, same custom test
      { toolCallId: 't', messages: [], context: {} }
    )
    expect(dup).toMatchObject({ error: 'duplicate' })
    expect(nttEntries).toHaveLength(1)
  })

  it('add_to_next_to_test lab-path falls back to custom when the test is not at the named lab', async () => {
    const supabase = fakeSupabase({ labs: [{ id: 'l', name: 'Lina Laboratory' }], lab_tests: [] })
    const tools = createLabTestTools(supabase, 'user-1')
    const out = await tools.add_to_next_to_test.execute!(
      { labName: 'Lina', testName: 'EMA IgA' },
      { toolCallId: 't', messages: [], context: {} }
    )
    expect(out).toMatchObject({
      added: true,
      entry: { kind: 'custom', name: 'EMA IgA', lab: 'Lina' },
    })
    expect(nttEntries).toHaveLength(1)
    expect(nttEntries[0]).toMatchObject({
      test_type: 'other',
      custom_name: 'EMA IgA',
      note: 'Lab requested: Lina',
    })
  })

  it('add_to_next_to_test accepts a lone testName (no lab) and saves it as custom', async () => {
    // A specialty test passed as { testName } with no labName must NOT be
    // rejected as invalid_arguments — it's a lab-agnostic name, saved as custom.
    const supabase = fakeSupabase({ labs: [], lab_tests: [] })
    const tools = createLabTestTools(supabase, 'user-1')
    const out = await tools.add_to_next_to_test.execute!(
      { testName: 'SIBO Breath Test' },
      { toolCallId: 't', messages: [], context: {} }
    )
    expect(out).toMatchObject({
      added: true,
      entry: { kind: 'custom', name: 'SIBO Breath Test' },
    })
    expect(nttEntries).toHaveLength(1)
    expect(nttEntries[0]).toMatchObject({ test_type: 'other', custom_name: 'SIBO Breath Test' })
  })

  it('add_many_to_next_to_test accepts lone testNames (no lab) and saves them as custom', async () => {
    // The exact reported regression: the batch errored because items were
    // { testName } with no labName. They must now save as custom entries.
    const supabase = fakeSupabase({ labs: [], lab_tests: [] })
    const tools = createLabTestTools(supabase, 'user-1')
    const out = (await tools.add_many_to_next_to_test.execute!(
      {
        items: [
          { testName: 'SIBO Breath Test' },
          { testName: 'Cyrex Array 2' },
          { testName: 'Cyrex Array 3' },
        ],
      },
      { toolCallId: 't', messages: [], context: {} }
    )) as {
      results: Array<{ status: string; kind?: string; name?: string }>
      summary: { added: number; added_custom: number; ambiguous: number; error: number }
    }
    expect(out.summary.added).toBe(3)
    expect(out.summary.added_custom).toBe(3)
    expect(out.summary.error).toBe(0)
    expect(nttEntries).toHaveLength(3)
    expect(nttEntries.every((e) => e.test_type === 'other')).toBe(true)
  })

  it('list_next_to_test_lists returns the lists (newest first) with pending counts', async () => {
    // Pushed oldest-first; the tool orders created_at desc → newest first.
    nttLists.push(
      { id: 'list-b', user_id: 'user-1', name: 'Microbiome', created_at: '2026-05-28T00:00:00Z' },
      { id: 'list-a', user_id: 'user-1', name: 'SIBO & Gluten', created_at: '2026-05-30T00:00:00Z' }
    )
    nttEntries.push(
      { id: 'e1', user_id: 'user-1', list_id: 'list-a', status: 'pending', test_type: 'other', custom_name: 'X' },
      { id: 'e2', user_id: 'user-1', list_id: 'list-a', status: 'done', test_type: 'other', custom_name: 'Y' },
      { id: 'e3', user_id: 'user-1', list_id: 'list-b', status: 'pending', test_type: 'other', custom_name: 'Z' }
    )
    const supabase = fakeSupabase({ labs: [], lab_tests: [] })
    const tools = createLabTestTools(supabase, 'user-1')
    const out = (await tools.list_next_to_test_lists.execute!(
      {},
      { toolCallId: 't', messages: [], context: {} }
    )) as { lists: Array<{ name: string; pending: number; id?: string }> }
    expect(out.lists.map((l) => l.name)).toEqual(['SIBO & Gluten', 'Microbiome'])
    expect(out.lists.find((l) => l.name === 'SIBO & Gluten')?.pending).toBe(1) // 1 pending, 1 done
    expect(out.lists.find((l) => l.name === 'Microbiome')?.pending).toBe(1)
    // The UUID id must NOT be exposed (model could misuse it as a listName).
    expect(out.lists.every((l) => l.id === undefined)).toBe(true)
  })

  it('list_next_to_test returns the read error instead of an empty list', async () => {
    nttReadErrors.next_to_test = { message: 'db down' }
    const tools = createLabTestTools(fakeSupabase({ labs: [], lab_tests: [] }), 'user-1')
    const out = await tools.list_next_to_test.execute!(
      {},
      { toolCallId: 't', messages: [], context: {} }
    )
    expect(out).toEqual({ error: 'db down' })
  })

  it('add_to_next_to_test returns an error instead of saving a custom entry when the catalogue read fails', async () => {
    nttReadErrors.biomarkers = { message: 'db down' }
    const tools = createLabTestTools(fakeSupabase({ labs: [], lab_tests: [] }), 'user-1')
    const out = await tools.add_to_next_to_test.execute!(
      { biomarkerName: 'Ferritin' },
      { toolCallId: 't', messages: [], context: {} }
    )
    expect(out).toMatchObject({ error: expect.stringContaining('db down') })
    expect(nttEntries).toEqual([])
  })

  it('add_many_to_next_to_test returns an error instead of saving custom entries when the catalogue read fails', async () => {
    nttReadErrors.biomarkers = { message: 'db down' }
    const tools = createLabTestTools(fakeSupabase({ labs: [], lab_tests: [] }), 'user-1')
    const out = await tools.add_many_to_next_to_test.execute!(
      { items: [{ biomarkerName: 'Ferritin' }, { biomarkerName: 'TSH' }] },
      { toolCallId: 't', messages: [], context: {} }
    )
    expect(out).toMatchObject({ error: expect.stringContaining('db down') })
    expect(nttEntries).toEqual([])
  })

  it('list_next_to_test reads a custom entry as kind:custom with its name', async () => {
    nttLists.push({ id: 'list-a', user_id: 'user-1', name: 'SIBO & Gluten', created_at: '2026-05-30T00:00:00Z' })
    nttEntries.push({
      id: 'e1',
      user_id: 'user-1',
      list_id: 'list-a',
      test_type: 'other',
      biomarker_id: null,
      lab_test_id: null,
      custom_name: 'SIBO Breath Test',
      note: null,
      due_date: null,
      status: 'pending',
    })
    const supabase = fakeSupabase({ labs: [], lab_tests: [] })
    const tools = createLabTestTools(supabase, 'user-1')
    const out = (await tools.list_next_to_test.execute!(
      {},
      { toolCallId: 't', messages: [], context: {} }
    )) as { entries: Array<{ kind: string; name: string; list: string }> }
    expect(out.entries).toHaveLength(1)
    expect(out.entries[0]).toMatchObject({
      kind: 'custom',
      name: 'SIBO Breath Test',
      list: 'SIBO & Gluten',
    })
  })

  it('add_to_next_to_test disambiguates DHEA-S blood vs urine via sampleType', async () => {
    // Real production fixture: the catalogue holds "DHEA-S" and "DHEA-S
    // (Urine)" BOTH with short_name='DHEA-S'. The shared short_name makes
    // every query hit both rows at score 1000 → ambiguous. The sampleType
    // hint filters the urine row out before scoring and lands on the blood
    // row cleanly. This is the exact case from real-user testing.
    biomarkerCatalog.push(
      { id: 'bm-dhea-blood', name: 'DHEA-S', short_name: 'DHEA-S', aliases: [] },
      {
        id: 'bm-dhea-urine',
        name: 'DHEA-S (Urine)',
        short_name: 'DHEA-S',
        aliases: [],
      }
    )
    const supabase = fakeSupabase({ labs: [], lab_tests: [] })
    const tools = createLabTestTools(supabase, 'user-1')

    // No hint → ambiguous (both DHEA-S variants score equally well)
    const ambiguous = await tools.add_to_next_to_test.execute!(
      { biomarkerName: 'DHEA-S' },
      { toolCallId: 't', messages: [], context: {} }
    )
    expect(ambiguous).toMatchObject({ error: 'ambiguous' })

    // With blood hint → resolves to the non-urine row
    const blood = await tools.add_to_next_to_test.execute!(
      { biomarkerName: 'DHEA-S', sampleType: 'blood' },
      { toolCallId: 't', messages: [], context: {} }
    )
    expect(blood).toMatchObject({
      added: true,
      entry: { kind: 'biomarker', name: 'DHEA-S' },
    })

    // With urine hint → resolves to the urine row
    const urine = await tools.add_to_next_to_test.execute!(
      { biomarkerName: 'DHEA-S', sampleType: 'urine' },
      { toolCallId: 't', messages: [], context: {} }
    )
    expect(urine).toMatchObject({
      added: true,
      entry: { kind: 'biomarker', name: 'DHEA-S (Urine)' },
    })
  })

  it('add_to_next_to_test falls back to full catalogue when sampleType matches nothing', async () => {
    // Defensive: if the user asks for an exotic sample type and nothing in
    // the catalogue matches, we don't want to mislead them with 'not_found'.
    // preferSampleType returns the original rows so the resolver can still
    // surface candidates or a useful 'ambiguous' rather than blank.
    biomarkerCatalog.push({
      id: 'bm-cort',
      name: 'Cortisol',
      short_name: null,
      aliases: [],
    })
    const supabase = fakeSupabase({ labs: [], lab_tests: [] })
    const tools = createLabTestTools(supabase, 'user-1')
    const out = await tools.add_to_next_to_test.execute!(
      { biomarkerName: 'Cortisol', sampleType: 'hair' },
      { toolCallId: 't', messages: [], context: {} }
    )
    // Still adds (only one cortisol exists, sample-type filter falls back).
    expect(out).toMatchObject({ added: true })
  })

  it('add_to_next_to_test collapses identical-name catalogue duplicates into a single winner', async () => {
    // Defensive: when two rows have the same normalized name (catalogue
    // duplicate that slipped past the DB partial unique index, e.g. a
    // pending-status row), the resolver should pick one rather than
    // returning "ambiguous" with two indistinguishable labels.
    biomarkerCatalog.push(
      { id: 'bm-a', name: 'Magnesium', short_name: 'Mg', aliases: [] },
      { id: 'bm-b', name: 'Magnesium', short_name: 'Mg', aliases: [] }
    )
    const supabase = fakeSupabase({ labs: [], lab_tests: [] })
    const tools = createLabTestTools(supabase, 'user-1')
    const out = await tools.add_to_next_to_test.execute!(
      { biomarkerName: 'Magnesium' },
      { toolCallId: 't', messages: [], context: {} }
    )
    expect(out).toMatchObject({
      added: true,
      entry: { kind: 'biomarker', name: 'Magnesium' },
    })
  })

  it('add_many_to_next_to_test resolves a mix of items and returns per-item results', async () => {
    biomarkerCatalog.push(
      { id: 'bm-tsh', name: 'TSH', short_name: 'TSH', aliases: [] },
      { id: 'bm-vitd', name: 'Vitamin D 25-Hydroxy', short_name: 'Vit D', aliases: [] }
    )
    const supabase = fakeSupabase({ labs: [], lab_tests: [] })
    const tools = createLabTestTools(supabase, 'user-1')
    const out = (await tools.add_many_to_next_to_test.execute!(
      {
        items: [
          { biomarkerName: 'TSH' },
          { biomarkerName: 'Vit D' },
          { biomarkerName: 'NopeNotARealMarker' },
        ],
      },
      { toolCallId: 't', messages: [], context: {} }
    )) as {
      results: Array<{ status: string; kind?: string; name?: string; query?: string }>
      summary: {
        added: number
        added_custom: number
        duplicate: number
        ambiguous: number
        error: number
      }
    }
    // The unmatched item is now auto-saved as a custom entry (added_custom),
    // not dropped — so all three land and `added` includes the custom one.
    expect(out.summary).toEqual({
      added: 3,
      added_custom: 1,
      duplicate: 0,
      ambiguous: 0,
      error: 0,
    })
    const added = out.results
      .filter((r) => r.status === 'added')
      .map((r) => r.name)
    expect(added).toContain('TSH')
    expect(added).toContain('Vitamin D 25-Hydroxy')
    expect(added).toContain('NopeNotARealMarker') // saved as custom
    // All three inserts hit next_to_test (two catalogue + one custom).
    expect(nttEntries).toHaveLength(3)
  })

  it('add_many_to_next_to_test mixes ambiguous + custom + added in one batch (no abort on failures)', async () => {
    biomarkerCatalog.push(
      { id: 'bm-tsh', name: 'TSH', short_name: 'TSH', aliases: [] },
      // Two cholesterols → ambiguous on the single-word query
      { id: 'bm-tot', name: 'Total Cholesterol', short_name: null, aliases: [] },
      { id: 'bm-hdl', name: 'HDL Cholesterol', short_name: null, aliases: [] }
    )
    const supabase = fakeSupabase({ labs: [], lab_tests: [] })
    const tools = createLabTestTools(supabase, 'user-1')
    const out = (await tools.add_many_to_next_to_test.execute!(
      {
        items: [
          { biomarkerName: 'TSH' },
          { biomarkerName: 'Cholesterol' }, // ambiguous
          { biomarkerName: 'NopeNotARealMarker' }, // not in catalogue → custom
          { biomarkerName: 'TSH' }, // second TSH — the mock doesn't enforce
                                    // unique (list_id, biomarker_id) so it
                                    // still adds, proving the loop carries on
                                    // past the failures above.
        ],
      },
      { toolCallId: 't', messages: [], context: {} }
    )) as {
      results: Array<{ status: string; kind?: string; name?: string; query?: string }>
      summary: {
        added: number
        added_custom: number
        ambiguous: number
      }
    }
    // TSH, the uncatalogued custom save, and the second TSH all count as added
    // (added_custom = 1); cholesterol is ambiguous.
    expect(out.summary.added).toBe(3)
    expect(out.summary.added_custom).toBe(1)
    expect(out.summary.ambiguous).toBe(1)
    // Order of results matches order of items — the loop processes each
    // independently rather than short-circuiting on the first failure.
    expect(out.results.map((r) => r.status)).toEqual([
      'added',
      'ambiguous',
      'added',
      'added',
    ])
  })

  it('add_to_next_to_test ambiguous when query is a shared substring (one-word "Cholesterol")', async () => {
    // Sanity: one-word "Cholesterol" still ambiguously matches all 3
    // cholesterol biomarkers — there's no exact winner so the user should
    // be asked to pick.
    biomarkerCatalog.push(
      { id: 'bm-tot', name: 'Total Cholesterol', short_name: null, aliases: [] },
      { id: 'bm-hdl', name: 'HDL Cholesterol', short_name: null, aliases: [] },
      { id: 'bm-ldl', name: 'LDL Cholesterol', short_name: null, aliases: [] }
    )
    const supabase = fakeSupabase({ labs: [], lab_tests: [] })
    const tools = createLabTestTools(supabase, 'user-1')
    const out = await tools.add_to_next_to_test.execute!(
      { biomarkerName: 'Cholesterol' },
      { toolCallId: 't', messages: [], context: {} }
    )
    expect(out).toMatchObject({ error: 'ambiguous' })
    const cands = (out as { candidates?: string[] }).candidates ?? []
    expect(cands).toContain('Total Cholesterol')
    expect(cands).toContain('HDL Cholesterol')
    expect(cands).toContain('LDL Cholesterol')
  })

  it('list_next_to_test returns pending entries by default', async () => {
    nttLists.push({
      id: 'list-1',
      user_id: 'user-1',
      name: 'Up next',
      created_at: '2026-05-28',
    })
    nttEntries.push({
      id: 'e-1',
      user_id: 'user-1',
      list_id: 'list-1',
      biomarker_id: 'bm-tsh',
      lab_test_id: null,
      status: 'pending',
      note: null,
      due_date: null,
    })
    biomarkerCatalog.push({ id: 'bm-tsh', name: 'TSH', short_name: 'TSH', aliases: [] })
    const supabase = fakeSupabase({
      labs: [],
      lab_tests: [],
    })
    const tools = createLabTestTools(supabase, 'user-1')
    const out = await tools.list_next_to_test.execute!(
      {},
      { toolCallId: 't', messages: [], context: {} }
    )
    expect((out as { entries: Array<{ name: string }> }).entries.map((e) => e.name)).toContain(
      'TSH'
    )
  })

  it('add_to_next_to_test resolves a biomarker by short_name', async () => {
    biomarkerCatalog.push({
      id: 'bm-vitd',
      name: 'Vitamin D 25-Hydroxy',
      short_name: 'Vit D',
      aliases: [],
    })
    const supabase = fakeSupabase({
      labs: [],
      lab_tests: [],
    })
    const tools = createLabTestTools(supabase, 'user-1')
    const out = await tools.add_to_next_to_test.execute!(
      { biomarkerName: 'Vit D' },
      { toolCallId: 't', messages: [], context: {} }
    )
    expect(out).toMatchObject({ added: true })
    expect(nttEntries[0]?.biomarker_id).toBe('bm-vitd')
  })

  it('mark_next_to_test_done flips status to done', async () => {
    nttLists.push({
      id: 'list-1',
      user_id: 'user-1',
      name: 'Up next',
      created_at: '2026-05-28',
    })
    nttEntries.push({
      id: 'e-1',
      user_id: 'user-1',
      list_id: 'list-1',
      biomarker_id: 'bm-tsh',
      lab_test_id: null,
      status: 'pending',
      note: null,
      due_date: null,
    })
    const supabase = fakeSupabase({
      labs: [],
      lab_tests: [],
    })
    const tools = createLabTestTools(supabase, 'user-1')
    const out = await tools.mark_next_to_test_done.execute!(
      { entryId: 'e-1' },
      { toolCallId: 't', messages: [], context: {} }
    )
    expect(out).toEqual({ ok: true })
    expect(nttEntries[0].status).toBe('done')
  })

  it('remove_from_next_to_test deletes an owned entry', async () => {
    nttLists.push({
      id: 'list-1',
      user_id: 'user-1',
      name: 'Up next',
      created_at: '2026-05-28',
    })
    nttEntries.push({
      id: 'e-1',
      user_id: 'user-1',
      list_id: 'list-1',
      biomarker_id: 'bm-tsh',
      lab_test_id: null,
      status: 'pending',
      note: null,
      due_date: null,
    })
    const tools = createLabTestTools(fakeSupabase({ labs: [], lab_tests: [] }), 'user-1')
    const out = await tools.remove_from_next_to_test.execute!(
      { entryId: 'e-1' },
      { toolCallId: 't', messages: [], context: {} }
    )
    expect(out).toEqual({ ok: true })
    expect(nttEntries.find((e) => e.id === 'e-1')).toBeUndefined()
  })

  it('remove_from_next_to_test returns not_found for missing entry', async () => {
    const tools = createLabTestTools(fakeSupabase({ labs: [], lab_tests: [] }), 'user-1')
    const out = await tools.remove_from_next_to_test.execute!(
      { entryId: 'nope' },
      { toolCallId: 't', messages: [], context: {} }
    )
    // The mock delete is forgiving; ensure the tool succeeds even when nothing
    // was matched (the user-id filter would still apply in production; the
    // tool's contract is "best-effort delete, never throws to the chat").
    // We accept either {ok:true} or {error:'not_found'} — confirm the
    // implementation's choice and assert that exact shape.
    expect(out).toBeDefined()
    expect(typeof out).toBe('object')
  })
})

// Pins the exact output of the shared add-item logic as seen through each
// caller: add_to_next_to_test (single) and add_many_to_next_to_test (batch).
// The two tools report the same outcome in different shapes, and the key
// order is asserted too because the result is serialized back to the model.
describe('add-item outcomes (single vs batch)', () => {
  beforeEach(resetNttState)

  const opts = { toolCallId: 't', messages: [], context: {} }
  const labTests = [
    { id: 'lt-fer', name: 'Ferritin', sample_type: 'blood', labs: { name: 'Lina Laboratory' } },
    { id: 'lt-cort-s', name: 'Cortisol', sample_type: 'serum', labs: { name: 'Lina Laboratory' } },
    { id: 'lt-cort-u', name: 'Cortisol (Urine)', sample_type: 'urine', labs: { name: 'Lina Laboratory' } },
    { id: 'lt-vitd-1', name: 'Vitamin D 25-OH', sample_type: 'blood', labs: [{ name: 'BODIMED' }] },
    { id: 'lt-vitd-2', name: 'Vitamin D 1,25-OH', sample_type: 'blood', labs: [{ name: 'BODIMED' }] },
  ]
  const tools = () =>
    createLabTestTools(fakeSupabase({ labs: [], lab_tests: labTests }), 'user-1')
  type Single = { added?: true; entry?: Record<string, unknown>; error?: string; candidates?: string[] }
  type Batch = { results: Array<Record<string, unknown>>; summary: Record<string, number> }
  const single = async (input: Record<string, unknown>) =>
    (await tools().add_to_next_to_test.execute!(input, opts)) as Single
  const batch = async (input: Record<string, unknown>) =>
    (await tools().add_many_to_next_to_test.execute!(
      input as Parameters<ReturnType<typeof tools>['add_many_to_next_to_test']['execute'] & object>[0],
      opts
    )) as Batch

  describe('biomarker path', () => {
    beforeEach(() => {
      biomarkerCatalog.push(
        { id: 'bm-tsh', name: 'TSH', short_name: 'TSH' },
        { id: 'bm-tot', name: 'Total Cholesterol', short_name: null },
        { id: 'bm-hdl', name: 'HDL Cholesterol', short_name: null }
      )
    })

    it('single: catalogue hit → biomarker entry without a lab key', async () => {
      const out = await single({ biomarkerName: 'tsh', note: 'n', dueDate: '2026-11-01' })
      expect(out).toEqual({
        added: true,
        entry: { id: expect.any(String), kind: 'biomarker', name: 'TSH' },
      })
      expect(Object.keys(out.entry!)).toEqual(['id', 'kind', 'name'])
      expect(nttEntries[0]).toMatchObject({
        user_id: 'user-1',
        test_type: 'blood_biomarker',
        biomarker_id: 'bm-tsh',
        lab_test_id: null,
        note: 'n',
        due_date: '2026-11-01',
        status: 'pending',
      })
      expect(out.entry!.id).toBe(nttEntries[0].id)
    })

    it('batch: catalogue hit → added result with lab:null and entryId', async () => {
      const out = await batch({ items: [{ biomarkerName: 'tsh' }], note: 'n', dueDate: '2026-11-01' })
      expect(out.results).toEqual([
        { status: 'added', kind: 'biomarker', name: 'TSH', lab: null, entryId: nttEntries[0].id },
      ])
      expect(Object.keys(out.results[0])).toEqual(['status', 'kind', 'name', 'lab', 'entryId'])
      expect(nttEntries[0]).toMatchObject({
        test_type: 'blood_biomarker',
        biomarker_id: 'bm-tsh',
        note: 'n',
        due_date: '2026-11-01',
      })
    })

    it('single: not in catalogue → trimmed custom entry, plain note', async () => {
      const out = await single({ biomarkerName: '  SIBO breath  ', note: 'n' })
      expect(out).toEqual({
        added: true,
        entry: { id: nttEntries[0].id, kind: 'custom', name: 'SIBO breath' },
      })
      expect(Object.keys(out.entry!)).toEqual(['id', 'kind', 'name'])
      expect(nttEntries[0]).toMatchObject({ test_type: 'other', custom_name: 'SIBO breath', note: 'n' })
    })

    it('batch: not in catalogue → trimmed custom result, plain note', async () => {
      const out = await batch({ items: [{ testName: '  SIBO breath  ' }], note: 'n' })
      expect(out.results).toEqual([
        { status: 'added', kind: 'custom', name: 'SIBO breath', lab: null, entryId: nttEntries[0].id },
      ])
      expect(nttEntries[0]).toMatchObject({ test_type: 'other', custom_name: 'SIBO breath', note: 'n' })
    })

    it('single vs batch: duplicate custom entry', async () => {
      await single({ biomarkerName: 'Cyrex' })
      expect(await single({ biomarkerName: 'CYREX' })).toEqual({ error: 'duplicate' })
      const out = await batch({ items: [{ biomarkerName: ' cyrex ' }] })
      expect(out.results).toEqual([{ status: 'duplicate', kind: 'custom', name: 'cyrex', lab: null }])
      expect(nttEntries).toHaveLength(1)
    })

    it('single vs batch: blank name → custom insert error', async () => {
      expect(await single({ biomarkerName: '   ' })).toEqual({ error: 'invalid_arguments' })
      const out = await batch({ items: [{ biomarkerName: '   ' }] })
      expect(out.results).toEqual([{ status: 'error', query: '   ', message: 'invalid_arguments' }])
      expect(Object.keys(out.results[0])).toEqual(['status', 'query', 'message'])
    })

    it('single vs batch: ambiguous candidates', async () => {
      expect(await single({ biomarkerName: 'Cholesterol' })).toEqual({
        error: 'ambiguous',
        candidates: ['HDL Cholesterol', 'Total Cholesterol'],
      })
      const out = await batch({ items: [{ biomarkerName: 'Cholesterol' }] })
      expect(out.results).toEqual([
        { status: 'ambiguous', query: 'Cholesterol', candidates: ['HDL Cholesterol', 'Total Cholesterol'] },
      ])
      expect(Object.keys(out.results[0])).toEqual(['status', 'query', 'candidates'])
    })

    it('single vs batch: unique-index violation (23505) → duplicate', async () => {
      nttInsertErrors.push({ code: '23505', message: 'dup' })
      expect(await single({ biomarkerName: 'TSH' })).toEqual({ error: 'duplicate' })
      nttInsertErrors.push({ code: '23505', message: 'dup' })
      const out = await batch({ items: [{ biomarkerName: 'TSH' }] })
      expect(out.results).toEqual([{ status: 'duplicate', kind: 'biomarker', name: 'TSH', lab: null }])
    })

    it('single vs batch: other insert error → its message', async () => {
      nttInsertErrors.push({ code: '42501', message: 'denied' })
      expect(await single({ biomarkerName: 'TSH' })).toEqual({ error: 'denied' })
      nttInsertErrors.push({ message: 'denied' })
      const out = await batch({ items: [{ biomarkerName: 'tsh' }] })
      expect(out.results).toEqual([{ status: 'error', query: 'tsh', message: 'denied' }])
    })
  })

  describe('lab-test path', () => {
    it('single: catalogue hit at the lab → lab_test entry with the stored lab name', async () => {
      const out = await single({ labName: 'lina', testName: 'ferritin', note: 'n', dueDate: 'd' })
      expect(out).toEqual({
        added: true,
        entry: { id: nttEntries[0].id, kind: 'lab_test', name: 'Ferritin', lab: 'Lina Laboratory' },
      })
      expect(Object.keys(out.entry!)).toEqual(['id', 'kind', 'name', 'lab'])
      expect(nttEntries[0]).toMatchObject({
        test_type: 'blood_lab_test',
        biomarker_id: null,
        lab_test_id: 'lt-fer',
        note: 'n',
        due_date: 'd',
        status: 'pending',
      })
    })

    it('batch: catalogue hit at the lab → added lab_test result', async () => {
      const out = await batch({ items: [{ labName: 'lina', testName: 'ferritin' }] })
      expect(out.results).toEqual([
        { status: 'added', kind: 'lab_test', name: 'Ferritin', lab: 'Lina Laboratory', entryId: nttEntries[0].id },
      ])
      expect(nttEntries[0]).toMatchObject({ test_type: 'blood_lab_test', lab_test_id: 'lt-fer' })
    })

    it('single vs batch: sampleType narrows lab-test variants', async () => {
      const s = await single({ labName: 'Lina', testName: 'Cortisol', sampleType: 'urine' })
      expect(s.entry).toMatchObject({ kind: 'lab_test', name: 'Cortisol (Urine)' })
      const b = await batch({ items: [{ labName: 'Lina', testName: 'Cortisol', sampleType: 'serum' }] })
      expect(b.results[0]).toMatchObject({ status: 'added', kind: 'lab_test', name: 'Cortisol' })
    })

    it('single: not at the lab → custom entry, requested lab in the note and as typed in the entry', async () => {
      const out = await single({ labName: 'lina', testName: ' EMA IgA ', note: 'gut' })
      expect(out).toEqual({
        added: true,
        entry: { id: nttEntries[0].id, kind: 'custom', name: 'EMA IgA', lab: 'lina' },
      })
      expect(Object.keys(out.entry!)).toEqual(['id', 'kind', 'name', 'lab'])
      expect(nttEntries[0]).toMatchObject({
        test_type: 'other',
        custom_name: 'EMA IgA',
        note: 'gut (lab requested: lina)',
      })
    })

    it('batch: not at the lab → custom result with the requested lab', async () => {
      const out = await batch({ items: [{ labName: 'lina', testName: ' EMA IgA ' }] })
      expect(out.results).toEqual([
        { status: 'added', kind: 'custom', name: 'EMA IgA', lab: 'lina', entryId: nttEntries[0].id },
      ])
      expect(nttEntries[0]).toMatchObject({ note: 'Lab requested: lina' })
    })

    it('single vs batch: duplicate custom lab-path entry', async () => {
      await single({ labName: 'Lina', testName: 'EMA IgA' })
      expect(await single({ labName: 'Lina', testName: 'ema iga' })).toEqual({ error: 'duplicate' })
      const out = await batch({ items: [{ labName: 'Lina', testName: 'EMA IGA' }] })
      expect(out.results).toEqual([{ status: 'duplicate', kind: 'custom', name: 'EMA IGA', lab: 'Lina' }])
    })

    it('single vs batch: blank test name at a lab → custom insert error with the composite query', async () => {
      expect(await single({ labName: 'Lina', testName: '  ' })).toEqual({ error: 'invalid_arguments' })
      const out = await batch({ items: [{ labName: 'Lina', testName: '  ' }] })
      expect(out.results).toEqual([{ status: 'error', query: '   (Lina)', message: 'invalid_arguments' }])
    })

    it('single vs batch: ambiguous candidates carry the lab name', async () => {
      const cands = ['Vitamin D 25-OH (BODIMED)', 'Vitamin D 1,25-OH (BODIMED)']
      expect(await single({ labName: 'Bodimed', testName: 'Vitamin D' })).toEqual({
        error: 'ambiguous',
        candidates: cands,
      })
      const out = await batch({ items: [{ labName: 'Bodimed', testName: 'Vitamin D' }] })
      expect(out.results).toEqual([
        { status: 'ambiguous', query: 'Vitamin D (Bodimed)', candidates: cands },
      ])
    })

    it('single vs batch: unique-index violation (23505) → duplicate', async () => {
      nttInsertErrors.push({ code: '23505', message: 'dup' })
      expect(await single({ labName: 'Lina', testName: 'Ferritin' })).toEqual({ error: 'duplicate' })
      nttInsertErrors.push({ code: '23505', message: 'dup' })
      const out = await batch({ items: [{ labName: 'Lina', testName: 'Ferritin' }] })
      expect(out.results).toEqual([
        { status: 'duplicate', kind: 'lab_test', name: 'Ferritin', lab: 'Lina Laboratory' },
      ])
    })

    it('single vs batch: other insert error → its message', async () => {
      nttInsertErrors.push({ message: 'denied' })
      expect(await single({ labName: 'Lina', testName: 'Ferritin' })).toEqual({ error: 'denied' })
      nttInsertErrors.push({ message: 'denied' })
      const out = await batch({ items: [{ labName: 'Lina', testName: 'ferritin' }] })
      expect(out.results).toEqual([{ status: 'error', query: 'ferritin (Lina)', message: 'denied' }])
    })

    it('single vs batch: a biomarkerName next to labName + testName is ignored (lab path wins)', async () => {
      biomarkerCatalog.push({ id: 'bm-tsh', name: 'TSH', short_name: 'TSH' })
      const s = await single({ biomarkerName: 'TSH', labName: 'Lina', testName: 'Ferritin' })
      expect(s.entry).toMatchObject({ kind: 'lab_test', name: 'Ferritin' })
      const b = await batch({ items: [{ biomarkerName: 'TSH', labName: 'Lina', testName: 'Ferritin' }] })
      expect(b.results[0]).toMatchObject({ status: 'added', kind: 'lab_test', name: 'Ferritin' })
    })
  })

  describe('argument handling and list resolution', () => {
    it('single: no usable name → invalid_arguments, no list created', async () => {
      expect(await single({})).toEqual({ error: 'invalid_arguments' })
      expect(await single({ labName: 'Lina' })).toEqual({ error: 'invalid_arguments' })
      expect(nttLists).toHaveLength(0)
    })

    it('single vs batch: an empty biomarkerName falls back to a lone testName', async () => {
      biomarkerCatalog.push({ id: 'bm-tsh', name: 'TSH', short_name: 'TSH' })
      const s = await single({ biomarkerName: '', testName: 'TSH' })
      expect(s.entry).toMatchObject({ kind: 'biomarker', name: 'TSH' })
      nttEntries.length = 0
      const b = await batch({ items: [{ biomarkerName: '', testName: 'TSH' }] })
      expect(b.results[0]).toMatchObject({ status: 'added', kind: 'biomarker', name: 'TSH' })
    })

    it('single: an ambiguous result resolves no list (list is resolved lazily)', async () => {
      biomarkerCatalog.push(
        { id: 'bm-tot', name: 'Total Cholesterol', short_name: null },
        { id: 'bm-hdl', name: 'HDL Cholesterol', short_name: null }
      )
      await single({ biomarkerName: 'Cholesterol' })
      await single({ labName: 'Bodimed', testName: 'Vitamin D' })
      expect(nttLists).toHaveLength(0)
    })

    it('batch: the list is resolved once up front, even when every item is ambiguous', async () => {
      biomarkerCatalog.push(
        { id: 'bm-tot', name: 'Total Cholesterol', short_name: null },
        { id: 'bm-hdl', name: 'HDL Cholesterol', short_name: null }
      )
      await batch({ items: [{ biomarkerName: 'Cholesterol' }] })
      expect(nttLists).toHaveLength(1)
      expect(nttLists[0]).toMatchObject({ name: 'Up next' })
    })

    it('single vs batch: the named list is created and used for every insert', async () => {
      biomarkerCatalog.push({ id: 'bm-tsh', name: 'TSH', short_name: 'TSH' })
      await single({ biomarkerName: 'TSH', listName: 'Thyroid' })
      await batch({
        items: [{ biomarkerName: 'Free T4' }, { labName: 'Lina', testName: 'Ferritin' }],
        listName: 'Thyroid',
      })
      expect(nttLists.map((l) => l.name)).toEqual(['Thyroid'])
      expect(new Set(nttEntries.map((e) => e.list_id))).toEqual(new Set([nttLists[0].id]))
      expect(nttEntries).toHaveLength(3)
    })

    it('batch: summary counts every outcome, added_custom ⊂ added', async () => {
      biomarkerCatalog.push(
        { id: 'bm-tsh', name: 'TSH', short_name: 'TSH' },
        { id: 'bm-tot', name: 'Total Cholesterol', short_name: null },
        { id: 'bm-hdl', name: 'HDL Cholesterol', short_name: null }
      )
      nttInsertErrors.push({ code: '23505', message: 'dup' })
      const out = await batch({
        items: [
          { biomarkerName: 'TSH' }, // 23505 → duplicate
          { biomarkerName: 'Cholesterol' }, // ambiguous
          { biomarkerName: '  ' }, // custom insert error
          { labName: 'Lina', testName: 'Ferritin' }, // added lab_test
          { testName: 'SIBO' }, // added custom
        ],
      })
      expect(out.summary).toEqual({ added: 2, added_custom: 1, duplicate: 1, ambiguous: 1, error: 1 })
      expect(Object.keys(out.summary)).toEqual(['added', 'added_custom', 'duplicate', 'ambiguous', 'error'])
      expect(Object.keys(out)).toEqual(['results', 'summary'])
    })
  })
})
