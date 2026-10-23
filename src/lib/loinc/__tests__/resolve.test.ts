import { describe, it, expect, vi } from 'vitest'

// The live column check is covered in shared-catalog.test.ts; here the
// database is taken to have the created_by column.
vi.mock('@/lib/catalog/shared-catalog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/catalog/shared-catalog')>()),
  creatorFields: async (_db: unknown, userId: string | null | undefined) =>
    userId ? { created_by: userId } : {},
}))

vi.mock('server-only', () => ({}))
const { mockTakeAiRequest } = vi.hoisted(() => ({
  mockTakeAiRequest: vi.fn(async () => ({ ok: true }) as { ok: boolean }),
}))
vi.mock('@/lib/ai/quota', () => ({ takeAiRequest: mockTakeAiRequest }))
import type Anthropic from '@anthropic-ai/sdk'
import type { Biomarker } from '@/lib/database.types'
import type { ReportMarker, ResolveDeps, CommitCaptureDeps, CommitCustomCaptureDeps } from '../resolve'
import { resolveMarker, commitCapture, commitCustomCapture } from '../resolve'
import type { ResolvedRange } from '../ranges'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBiomarker(overrides: Partial<Biomarker> & Pick<Biomarker, 'id' | 'name'>): Biomarker {
  return {
    short_name: null,
    category: 'General',
    unit: 'ng/mL',
    description: null,
    ref_range_low: null,
    ref_range_high: null,
    ref_range_low_male: null,
    ref_range_high_male: null,
    ref_range_low_female: null,
    ref_range_high_female: null,
    range_source: null,
    aliases: [],
    parent_id: null,
    variant_name: null,
    panel_id: null,
    archived_at: null,
    loinc_code: null,
    is_custom: false,
    method: null,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Supabase stub builder
// ---------------------------------------------------------------------------

/**
 * Build a minimal chainable Supabase stub. Per-table canned responses keyed by
 * table name. Tracks whether `.insert()` was called (for the no-insert assertion).
 */
function buildDbStub(responses: Record<string, unknown>, insertSpy?: { called: boolean }) {
  return {
    from(table: string) {
      const tableResponse = responses[table]

      // Chainable object that eventually resolves
      const chain = {
        _table: table,
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        is: () => chain,
        single: () => Promise.resolve(tableResponse),
        // make chain itself awaitable (when no .single())
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(tableResponse).then(resolve, reject),
        insert: () => {
          if (insertSpy) insertSpy.called = true
          // allow accessing responses keyed with "insert:<table>"
          const insertResp = responses[`insert:${table}`] ?? tableResponse
          return {
            select: () => ({
              single: () => Promise.resolve(insertResp),
            }),
          }
        },
      }
      return chain
    },
  }
}

// ---------------------------------------------------------------------------
// Group A: Fast path — match against existing catalog
// ---------------------------------------------------------------------------

describe('resolveMarker — Group A: fast path', () => {
  const ferritinBiomarker = makeBiomarker({
    id: 'bm-ferritin',
    name: 'Ferritin',
    loinc_code: '2276-4',
  })

  it('returns matched/existing when catalog contains the marker by name', async () => {
    const marker: ReportMarker = { name: 'Ferritin', unit: 'ng/mL' }
    const catalog: Biomarker[] = [ferritinBiomarker]
    const deps: ResolveDeps = { db: buildDbStub({}) as never }

    const result = await resolveMarker(marker, catalog, deps)

    expect(result).toEqual({
      status: 'matched',
      biomarkerId: 'bm-ferritin',
      via: 'existing',
    })
  })

  it('is case-insensitive in name matching', async () => {
    const marker: ReportMarker = { name: 'ferritin', unit: 'ng/mL' }
    const catalog: Biomarker[] = [ferritinBiomarker]
    const deps: ResolveDeps = { db: buildDbStub({}) as never }

    const result = await resolveMarker(marker, catalog, deps)

    expect(result).toEqual({
      status: 'matched',
      biomarkerId: 'bm-ferritin',
      via: 'existing',
    })
  })
})

// ---------------------------------------------------------------------------
// Group B: AI-code path — marker.loinc_code resolves to capturable (NO write)
// ---------------------------------------------------------------------------

describe('resolveMarker — Group B: AI-code capturable (read-only)', () => {
  const activeLoincTerm = {
    loinc_num: '30248-9',
    component: 'Transferrin receptor.soluble',
    property: 'MCnc',
    system: 'Ser/Plas',
    scale_typ: 'Qn',
    method_typ: null,
    long_common_name: 'Transferrin receptor.soluble [Mass/volume] in Serum or Plasma',
    short_name: 'sTfR Ser/Plas-mCnc',
    example_ucum_units: 'mg/L',
    classtype: 1,
    status: 'ACTIVE',
  }

  const displayRow = {
    loinc_num: '30248-9',
    clean_name: 'Soluble Transferrin Receptor',
    abbreviation: 'sTfR',
  }

  it('returns capturable with loincCode + cleanName when catalog has no match — performs NO insert', async () => {
    const marker: ReportMarker = {
      name: 'Transferrin receptor soluble',
      unit: 'mg/L',
      loinc_code: '30248-9',
    }
    const catalog: Biomarker[] = [] // no existing biomarker

    const insertSpy = { called: false }
    const db = buildDbStub({
      // loinc_terms lookup returns the lab-active term
      loinc_terms: { data: [activeLoincTerm], error: null },
      // loinc_display lookup
      loinc_display: { data: [displayRow], error: null },
    }, insertSpy) as never

    const deps: ResolveDeps = { db }
    const result = await resolveMarker(marker, catalog, deps)

    expect(result).toEqual({
      status: 'capturable',
      loincCode: '30248-9',
      cleanName: 'Soluble Transferrin Receptor',
    })
    // CRITICAL: no insert should have been made during resolution
    expect(insertSpy.called).toBe(false)
  })

  it('returns matched/ai_code when catalog already has a biomarker with that loinc_code', async () => {
    const existingBiomarker = makeBiomarker({
      id: 'existing-bm',
      name: 'Soluble Transferrin Receptor',
      loinc_code: '30248-9',
    })

    const marker: ReportMarker = {
      name: 'sTfR',
      unit: 'mg/L',
      loinc_code: '30248-9',
    }
    const catalog: Biomarker[] = [existingBiomarker]

    const db = buildDbStub({
      loinc_terms: { data: [activeLoincTerm], error: null },
    }) as never

    const deps: ResolveDeps = { db }
    const result = await resolveMarker(marker, catalog, deps)

    expect(result).toEqual({
      status: 'matched',
      biomarkerId: 'existing-bm',
      via: 'ai_code',
    })
  })

  it('falls through to step 3 when loinc_code is not found in loinc_terms', async () => {
    const marker: ReportMarker = {
      name: 'SomeObscureMarker',
      unit: 'U/L',
      loinc_code: '99999-9', // doesn't exist
    }
    const catalog: Biomarker[] = []

    const db = buildDbStub({
      // loinc_terms returns empty for this code
      loinc_terms: { data: [], error: null },
    }) as never

    // Inject a searchLoinc that also returns nothing so we end at unresolved
    const fakeSearch = vi.fn().mockResolvedValue([])
    const deps: ResolveDeps = { db, searchLoinc: fakeSearch }
    const result = await resolveMarker(marker, catalog, deps)

    expect(result).toEqual({ status: 'unresolved', name: 'SomeObscureMarker' })
    expect(fakeSearch).toHaveBeenCalledWith('SomeObscureMarker')
  })

  it('uses marker.name as cleanName when loinc_display has no clean_name', async () => {
    const marker: ReportMarker = {
      name: 'Transferrin receptor soluble',
      unit: 'mg/L',
      loinc_code: '30248-9',
    }
    const catalog: Biomarker[] = []

    const db = buildDbStub({
      loinc_terms: { data: [activeLoincTerm], error: null },
      loinc_display: { data: [], error: null }, // no display row
    }) as never

    const deps: ResolveDeps = { db }
    const result = await resolveMarker(marker, catalog, deps)

    expect(result).toEqual({
      status: 'capturable',
      loincCode: '30248-9',
      cleanName: 'Transferrin receptor soluble',
    })
  })
})

// ---------------------------------------------------------------------------
// Group C: Deterministic fallback + threshold
// ---------------------------------------------------------------------------

describe('resolveMarker — Group C: deterministic fallback + threshold', () => {
  const activeLoincTerm = {
    loinc_num: '30248-9',
    component: 'Transferrin receptor.soluble',
    property: 'MCnc',
    system: 'Ser/Plas',
    scale_typ: 'Qn',
    method_typ: null,
    long_common_name: 'Transferrin receptor.soluble [Mass/volume] in Serum or Plasma',
    short_name: 'sTfR Ser/Plas-mCnc',
    example_ucum_units: 'mg/L',
    classtype: 1,
    status: 'ACTIVE',
  }

  const displayRow = {
    loinc_num: '30248-9',
    clean_name: 'Soluble Transferrin Receptor',
    abbreviation: 'sTfR',
  }

  const candidateAboveThreshold = {
    code: '30248-9',
    longName: 'Transferrin receptor.soluble [Mass/volume] in Serum or Plasma',
    component: 'Transferrin receptor.soluble',
    ucumUnit: 'mg/L',
    method: null,
    property: 'MCnc',
  }

  it('returns capturable via fallback when searchLoinc returns a high-confidence candidate — NO insert', async () => {
    const marker: ReportMarker = { name: 'Transferrin receptor.soluble', unit: 'mg/L' }
    const catalog: Biomarker[] = []

    const insertSpy = { called: false }
    const db = buildDbStub({
      loinc_terms: { data: [activeLoincTerm], error: null },
      loinc_display: { data: [displayRow], error: null },
    }, insertSpy) as never

    const fakeSearch = vi.fn().mockResolvedValue([candidateAboveThreshold])
    const deps: ResolveDeps = {
      db,
      searchLoinc: fakeSearch,
    }

    const result = await resolveMarker(marker, catalog, deps)

    expect(result).toEqual({
      status: 'capturable',
      loincCode: '30248-9',
      cleanName: 'Soluble Transferrin Receptor',
    })
    expect(fakeSearch).toHaveBeenCalledWith('Transferrin receptor.soluble')
    // CRITICAL: resolve is read-only — no insert
    expect(insertSpy.called).toBe(false)
  })

  it('returns unresolved and does NOT insert when top candidate is below threshold', async () => {
    const marker: ReportMarker = { name: 'VeryObscureMarker', unit: 'U/L' }
    const catalog: Biomarker[] = []

    // A candidate that scores below 0.6 — name has no overlap with 'VeryObscureMarker'
    const lowConfidenceCandidate = {
      code: '99100-1',
      longName: 'Completely Different Analyte in Serum',
      component: 'CompleteDifferentAnalyte',
      ucumUnit: 'U/L',
      method: null,
      property: 'ArbitraryProperty',
    }

    const insertSpy = { called: false }
    const db = buildDbStub(
      {
        // loinc_terms validate: returns a term so it passes the "exists" check
        loinc_terms: {
          data: [
            {
              loinc_num: '99100-1',
              component: 'CompleteDifferentAnalyte',
              property: null,
              system: 'Ser/Plas',
              scale_typ: 'Qn',
              method_typ: null,
              long_common_name: 'Completely Different Analyte in Serum',
              short_name: null,
              example_ucum_units: 'U/L',
              classtype: 1,
              status: 'ACTIVE',
            },
          ],
          error: null,
        },
      },
      insertSpy,
    ) as never

    const fakeSearch = vi.fn().mockResolvedValue([lowConfidenceCandidate])
    const deps: ResolveDeps = { db, searchLoinc: fakeSearch }

    const result = await resolveMarker(marker, catalog, deps)

    expect(result).toEqual({ status: 'unresolved', name: 'VeryObscureMarker' })
    expect(insertSpy.called).toBe(false)
  })

  it('returns matched/fallback when fallback candidate matches an existing catalog biomarker', async () => {
    const existingBiomarker = makeBiomarker({
      id: 'bm-stfr',
      name: 'Soluble Transferrin Receptor',
      loinc_code: '30248-9',
    })

    const marker: ReportMarker = { name: 'Transferrin receptor.soluble', unit: 'mg/L' }
    const catalog: Biomarker[] = [existingBiomarker]

    const insertSpy = { called: false }
    const db = buildDbStub(
      {
        loinc_terms: { data: [activeLoincTerm], error: null },
      },
      insertSpy,
    ) as never

    const fakeSearch = vi.fn().mockResolvedValue([candidateAboveThreshold])
    const deps: ResolveDeps = { db, searchLoinc: fakeSearch }

    const result = await resolveMarker(marker, catalog, deps)

    expect(result).toEqual({
      status: 'matched',
      biomarkerId: 'bm-stfr',
      via: 'fallback',
    })
    expect(insertSpy.called).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Group D: commitCapture — the write path
// ---------------------------------------------------------------------------

/**
 * Like buildDbStub but also records the last row passed to `.insert()` on the
 * 'biomarkers' table, and every `.upsert()` (the creator's display-unit
 * preference), so we can assert on what was written.
 */
function buildDbStubWithInsertCapture(
  responses: Record<string, unknown>,
): {
  db: never
  lastInsertedRow: { value: Record<string, unknown> | null }
  upserts: { table: string; row: Record<string, unknown> }[]
} {
  const lastInsertedRow: { value: Record<string, unknown> | null } = { value: null }
  const upserts: { table: string; row: Record<string, unknown> }[] = []

  const db = {
    from(table: string) {
      const tableResponse = responses[table]

      const chain = {
        _table: table,
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        is: () => chain,
        single: () => Promise.resolve(tableResponse),
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(tableResponse).then(resolve, reject),
        insert: (row: unknown) => {
          if (table === 'biomarkers') {
            lastInsertedRow.value = row as Record<string, unknown>
          }
          const insertResp = responses[`insert:${table}`] ?? tableResponse
          return {
            select: () => ({
              single: () => Promise.resolve(insertResp),
            }),
          }
        },
        upsert: (row: unknown) => {
          upserts.push({ table, row: row as Record<string, unknown> })
          return Promise.resolve({ data: null, error: null })
        },
      }
      return chain
    },
  }

  return { db: db as never, lastInsertedRow, upserts }
}

describe('commitCapture — Group D: write path', () => {
  const activeLoincTerm = {
    loinc_num: '2276-4',
    component: 'Ferritin',
    property: 'MCnc',
    system: 'Ser/Plas',
    scale_typ: 'Qn',
    method_typ: null,
    long_common_name: 'Ferritin [Mass/volume] in Serum or Plasma',
    short_name: 'Ferritin Ser Pl-mCnc',
    example_ucum_units: 'ng/mL',
    classtype: 1,
    status: 'ACTIVE',
  }

  const displayRow = {
    loinc_num: '2276-4',
    clean_name: 'Ferritin',
    abbreviation: null,
  }

  it('inserts a biomarker row and returns the id', async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      loinc_terms: { data: [activeLoincTerm], error: null },
      loinc_display: { data: [displayRow], error: null },
      'insert:biomarkers': { data: { id: 'bm-ferritin' }, error: null },
    })

    const deps: CommitCaptureDeps = { db, estimateRange: vi.fn().mockResolvedValue(null) }
    const id = await commitCapture('2276-4', { unit: 'ng/mL' }, deps)

    expect(id).toBe('bm-ferritin')
    expect(lastInsertedRow.value).toMatchObject({
      loinc_code: '2276-4',
      unit: 'ng/mL',
    })
  })

  it('stores the LOINC unit on the shared row, never the user unit', async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      loinc_terms: { data: [activeLoincTerm], error: null },
      loinc_display: { data: [displayRow], error: null },
      'insert:biomarkers': { data: { id: 'bm-ferritin' }, error: null },
    })
    const fakeEstimateRange = vi.fn<() => Promise<ResolvedRange | null>>().mockResolvedValue(null)
    const fakeAi = {} as unknown as Anthropic

    const deps: CommitCaptureDeps = { db, estimateRange: fakeEstimateRange, ai: fakeAi }
    await commitCapture('2276-4', { unit: 'µg/L' }, deps)

    expect(lastInsertedRow.value).toMatchObject({ unit: 'ng/mL' })
    // The range estimate is anchored on the LOINC unit too.
    expect(fakeEstimateRange).toHaveBeenCalledWith('2276-4', 'Ferritin', 'ng/mL', fakeAi)
  })

  it('writes UCUM example units in lab spelling', async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      loinc_terms: {
        data: [{ ...activeLoincTerm, example_ucum_units: '10*3/uL' }],
        error: null,
      },
      loinc_display: { data: [displayRow], error: null },
      'insert:biomarkers': { data: { id: 'bm-x' }, error: null },
    })

    const deps: CommitCaptureDeps = { db, estimateRange: vi.fn().mockResolvedValue(null) }
    await commitCapture('2276-4', { unit: '10^9/L' }, deps)

    expect(lastInsertedRow.value).toMatchObject({ unit: '10^3/uL' })
  })

  it('leaves the unit empty and skips the range when LOINC has no unit', async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      loinc_terms: {
        data: [{ ...activeLoincTerm, example_ucum_units: null }],
        error: null,
      },
      loinc_display: { data: [displayRow], error: null },
      'insert:biomarkers': { data: { id: 'bm-x' }, error: null },
    })
    const fakeEstimateRange = vi.fn<() => Promise<ResolvedRange | null>>().mockResolvedValue({
      low: 1,
      high: 2,
      source: 'ai_estimated',
    })

    const deps: CommitCaptureDeps = { db, estimateRange: fakeEstimateRange }
    await commitCapture('2276-4', { unit: 'mg/L' }, deps)

    expect(lastInsertedRow.value).toMatchObject({ unit: '' })
    expect(lastInsertedRow.value).not.toHaveProperty('ref_range_low')
    expect(fakeEstimateRange).not.toHaveBeenCalled()
  })

  it('never copies a printed report range into the shared row', async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      loinc_terms: { data: [activeLoincTerm], error: null },
      loinc_display: { data: [displayRow], error: null },
      'insert:biomarkers': { data: { id: 'bm-ferritin' }, error: null },
    })

    const fakeEstimateRange = vi.fn<() => Promise<ResolvedRange | null>>().mockResolvedValue({
      low: 15,
      high: 150,
      source: 'ai_estimated',
    })

    const deps: CommitCaptureDeps = { db, estimateRange: fakeEstimateRange }
    // A crafted payload may still carry report range fields.
    const marker = { unit: 'ng/mL', ref_range_low: 1, ref_range_high: 99999 }
    await commitCapture('2276-4', marker, deps)

    expect(lastInsertedRow.value).toMatchObject({
      ref_range_low: 15,
      ref_range_high: 150,
      range_source: 'ai_estimated',
    })
  })

  it('calls estimateRange and sets ai_estimated columns', async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      loinc_terms: { data: [activeLoincTerm], error: null },
      loinc_display: { data: [displayRow], error: null },
      'insert:biomarkers': { data: { id: 'bm-ferritin' }, error: null },
    })

    const estimatedRange: ResolvedRange = {
      low: 12,
      high: 300,
      lowMale: 30,
      highMale: 400,
      lowFemale: 12,
      highFemale: 150,
      source: 'ai_estimated',
    }
    const fakeEstimateRange = vi.fn<() => Promise<ResolvedRange | null>>().mockResolvedValue(estimatedRange)
    const fakeAi = {} as unknown as Anthropic

    const deps: CommitCaptureDeps = { db, estimateRange: fakeEstimateRange, ai: fakeAi }
    const id = await commitCapture('2276-4', { unit: 'ng/mL' }, deps)

    expect(id).toBe('bm-ferritin')
    expect(fakeEstimateRange).toHaveBeenCalledOnce()
    expect(lastInsertedRow.value).toMatchObject({
      ref_range_low: 12,
      ref_range_high: 300,
      ref_range_low_male: 30,
      ref_range_high_male: 400,
      ref_range_low_female: 12,
      ref_range_high_female: 150,
      range_source: 'ai_estimated',
    })
  })

  it('inserts without range columns when estimateRange returns null', async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      loinc_terms: { data: [activeLoincTerm], error: null },
      loinc_display: { data: [displayRow], error: null },
      'insert:biomarkers': { data: { id: 'bm-ferritin' }, error: null },
    })

    const fakeEstimateRange = vi.fn<() => Promise<ResolvedRange | null>>().mockResolvedValue(null)

    const deps: CommitCaptureDeps = { db, estimateRange: fakeEstimateRange }
    await commitCapture('2276-4', { unit: 'ng/mL' }, deps)

    expect(lastInsertedRow.value).not.toHaveProperty('ref_range_low')
    expect(lastInsertedRow.value).not.toHaveProperty('range_source')
  })

  it('never stores the raw lab name as an alias on the shared row', async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      loinc_terms: { data: [activeLoincTerm], error: null },
      loinc_display: { data: [displayRow], error: null }, // clean_name: 'Ferritin'
      'insert:biomarkers': { data: { id: 'bm-ferritin' }, error: null },
    })

    const deps: CommitCaptureDeps = { db, estimateRange: vi.fn().mockResolvedValue(null) }
    await commitCapture('2276-4', { name: 'Vitamin D', unit: 'ng/mL' }, deps)

    // A crafted name could otherwise hijack another marker's spelling for
    // every user's future imports.
    expect(lastInsertedRow.value).toMatchObject({ name: 'Ferritin', aliases: [] })
  })

  it('falls back to the LOINC long common name (never the raw lab name or the unit)', async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      loinc_terms: { data: [activeLoincTerm], error: null },
      // no display row → no clean_name
      loinc_display: { data: [], error: null },
      'insert:biomarkers': { data: { id: 'bm-ferritin' }, error: null },
    })

    const deps: CommitCaptureDeps = { db, estimateRange: vi.fn().mockResolvedValue(null) }
    await commitCapture('2276-4', { name: 'S-Ferritine', unit: 'ng/mL' }, deps)

    expect(lastInsertedRow.value).toMatchObject({
      name: 'Ferritin [Mass/volume] in Serum or Plasma',
      aliases: [],
    })
  })

  it('records the creator and keeps their own unit as display preference', async () => {
    const { db, lastInsertedRow, upserts } = buildDbStubWithInsertCapture({
      loinc_terms: { data: [activeLoincTerm], error: null },
      loinc_display: { data: [displayRow], error: null },
      'insert:biomarkers': { data: { id: 'bm-ferritin' }, error: null },
    })

    const deps: CommitCaptureDeps = {
      db,
      estimateRange: vi.fn().mockResolvedValue(null),
      createdBy: 'user-1',
    }
    await commitCapture('2276-4', { unit: 'pmol/L' }, deps)

    expect(lastInsertedRow.value).toMatchObject({ created_by: 'user-1', unit: 'ng/mL' })
    expect(upserts).toEqual([
      {
        table: 'user_unit_preferences',
        row: { user_id: 'user-1', biomarker_id: 'bm-ferritin', preferred_unit: 'pmol/L' },
      },
    ])
  })

  it("skips the range estimate when the creator is over the AI limit", async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      loinc_terms: { data: [activeLoincTerm], error: null },
      loinc_display: { data: [displayRow], error: null },
      'insert:biomarkers': { data: { id: 'bm-ferritin' }, error: null },
    })
    mockTakeAiRequest.mockResolvedValueOnce({ ok: false })
    const estimateRange = vi.fn().mockResolvedValue(null)

    await commitCapture('2276-4', { unit: 'ng/mL' }, { db, estimateRange, createdBy: 'user-1' })

    expect(mockTakeAiRequest).toHaveBeenCalledWith('user-1')
    expect(estimateRange).not.toHaveBeenCalled()
    expect(lastInsertedRow.value).toMatchObject({ created_by: 'user-1' })
  })

  it('adds no preference when the creator unit is the catalogue unit', async () => {
    const { db, upserts } = buildDbStubWithInsertCapture({
      loinc_terms: { data: [activeLoincTerm], error: null },
      loinc_display: { data: [displayRow], error: null },
      'insert:biomarkers': { data: { id: 'bm-ferritin' }, error: null },
    })

    const deps: CommitCaptureDeps = {
      db,
      estimateRange: vi.fn().mockResolvedValue(null),
      createdBy: 'user-1',
    }
    await commitCapture('2276-4', { unit: 'µg/L' }, deps) // same unit as ng/mL

    expect(upserts).toEqual([])
  })

  it('re-selects the existing row on a 23505 unique-violation (lost insert race)', async () => {
    const db = buildDbStub({
      loinc_terms: { data: [activeLoincTerm], error: null },
      loinc_display: { data: [displayRow], error: null },
      // insert loses the race against a UNIQUE index
      'insert:biomarkers': { data: null, error: { code: '23505' } },
      // post-conflict re-select (.eq('loinc_code').is('archived_at', null).single())
      biomarkers: { data: { id: 'raced-winner' }, error: null },
    }) as never

    const deps: CommitCaptureDeps = { db, estimateRange: vi.fn().mockResolvedValue(null) }
    const id = await commitCapture('2276-4', { unit: 'ng/mL' }, deps)

    expect(id).toBe('raced-winner')
  })

  it('throws and does NOT insert when the LOINC code is unknown/inactive', async () => {
    // loinc_terms returns no row for the code (filtered to classtype=1 + ACTIVE).
    // A crafted/buggy save payload could pass a fake code; we must refuse it
    // before writing to the GLOBAL biomarkers catalog.
    const insertSpy = { called: false }
    const db = buildDbStub(
      {
        loinc_terms: { data: [], error: null },
        loinc_display: { data: [], error: null },
      },
      insertSpy,
    ) as never

    const deps: CommitCaptureDeps = { db, estimateRange: vi.fn().mockResolvedValue(null) }

    await expect(commitCapture('99999-9', { unit: 'mg/L' }, deps)).rejects.toThrow(
      /LOINC code 99999-9 not found\/inactive/,
    )
    expect(insertSpy.called).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Group E: commitCustomCapture — non-LOINC write path
// ---------------------------------------------------------------------------

describe('commitCustomCapture — Group E: custom write path', () => {
  it('inserts a custom row with no catalogue unit and returns the id', async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      'insert:biomarkers': { data: { id: 'bm-aaepa' }, error: null },
    })

    const deps: CommitCustomCaptureDeps = { db }
    const id = await commitCustomCapture({ name: 'AA/EPA', unit: 'ratio' }, deps)

    expect(id).toBe('bm-aaepa')
    expect(lastInsertedRow.value).toMatchObject({
      name: 'AA/EPA',
      unit: '',
      category: 'Other',
      loinc_code: null,
      is_custom: true,
      aliases: [],
    })
  })

  it('never copies a printed report range into the shared row', async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      'insert:biomarkers': { data: { id: 'bm-amh' }, error: null },
    })

    const deps: CommitCustomCaptureDeps = { db }
    const marker = { name: 'Anti-Müllerian Hormone', unit: 'ng/mL', ref_range_low: 0.147, ref_range_high: 7.49 }
    await commitCustomCapture(marker, deps)

    expect(lastInsertedRow.value).toMatchObject({ is_custom: true, unit: '' })
    expect(lastInsertedRow.value).not.toHaveProperty('ref_range_low')
    expect(lastInsertedRow.value).not.toHaveProperty('range_source')
  })

  it('cleans and length-limits the name and category', async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      'insert:biomarkers': { data: { id: 'bm-x' }, error: null },
    })

    const deps: CommitCustomCaptureDeps = { db }
    await commitCustomCapture(
      { name: `  DGLA‮\u0000  ${'x'.repeat(300)}`, unit: 'mg/l', category: `Fatty\nacids${'y'.repeat(100)}` },
      deps,
    )

    const row = lastInsertedRow.value as { name: string; category: string }
    expect(row.name.startsWith('DGLA x')).toBe(true)
    expect(Array.from(row.name).length).toBeLessThanOrEqual(120)
    expect(row.name).not.toMatch(/[\u0000‮]/)
    expect(row.category.startsWith('Fatty acids')).toBe(true)
    expect(row.category.length).toBeLessThanOrEqual(60)
  })

  it("records the creator and keeps the creator's unit as display preference", async () => {
    const { db, lastInsertedRow, upserts } = buildDbStubWithInsertCapture({
      'insert:biomarkers': { data: { id: 'bm-dgla' }, error: null },
    })

    const deps: CommitCustomCaptureDeps = { db, createdBy: 'user-1' }
    await commitCustomCapture({ name: 'DGLA', unit: 'mg/l' }, deps)

    expect(lastInsertedRow.value).toMatchObject({ created_by: 'user-1', unit: '' })
    expect(upserts).toEqual([
      {
        table: 'user_unit_preferences',
        row: { user_id: 'user-1', biomarker_id: 'bm-dgla', preferred_unit: 'mg/l' },
      },
    ])
  })

  it('re-selects the existing row on a 23505 name unique-violation', async () => {
    const db = buildDbStub({
      'insert:biomarkers': { data: null, error: { code: '23505' } },
      // post-conflict re-select by name (.eq('name').is('archived_at', null).single())
      biomarkers: { data: { id: 'existing-custom' }, error: null },
    }) as never

    const deps: CommitCustomCaptureDeps = { db }
    const id = await commitCustomCapture({ name: 'AA/EPA', unit: 'ratio' }, deps)

    expect(id).toBe('existing-custom')
  })

  it('throws when the marker name is empty', async () => {
    const { db } = buildDbStubWithInsertCapture({})
    const deps: CommitCustomCaptureDeps = { db }
    await expect(commitCustomCapture({ name: '   ', unit: 'ratio' }, deps)).rejects.toThrow(
      /name is required/,
    )
  })
})

// ---------------------------------------------------------------------------
// Group containers (regression: total bilirubin landed on Bilirubin (Direct))
// ---------------------------------------------------------------------------

describe('resolveMarker — group containers', () => {
  const bilirubinTerm = {
    loinc_num: '1975-2', component: 'Bilirubin', property: 'MCnc', system: 'Ser/Plas',
    scale_typ: 'Qn', method_typ: null, long_common_name: 'Bilirubin.total', short_name: null,
    example_ucum_units: 'mg/dL', classtype: 1, status: 'ACTIVE',
  }
  const parent = makeBiomarker({ id: 'bil', name: 'Bilirubin', loinc_code: '1975-2' })
  const direct = makeBiomarker({
    id: 'dbil', name: 'Bilirubin (Direct)', parent_id: 'bil', variant_name: 'direct', loinc_code: '1968-7',
  })
  const deps = (): ResolveDeps => ({
    db: buildDbStub({ loinc_terms: { data: [bilirubinTerm], error: null } }) as never,
    searchLoinc: async () => [],
  })

  it('never maps "Bilirubin" to the direct child of a container', async () => {
    const result = await resolveMarker({ name: 'Bilirubin', unit: 'mg/dL' }, [parent, direct], deps())
    expect(result).toEqual({ status: 'unresolved', name: 'Bilirubin' })
  })

  it('does not match a LOINC code owned by a container', async () => {
    const result = await resolveMarker(
      { name: 'Bili tot', unit: 'mg/dL', loinc_code: '1975-2' }, [parent, direct], deps()
    )
    expect(result.status).toBe('unresolved')
  })

  it('uses the total variant when the container has one', async () => {
    const total = makeBiomarker({ id: 'tbil', name: 'Bilirubin (Total)', parent_id: 'bil', variant_name: 'total' })
    const result = await resolveMarker(
      { name: 'Bili tot', unit: 'mg/dL', loinc_code: '1975-2' }, [parent, direct, total], deps()
    )
    expect(result).toEqual({ status: 'matched', biomarkerId: 'tbil', via: 'ai_code' })
  })

  it('lands total bilirubin on "Bilirubin" once it is a standalone marker', async () => {
    const standaloneDirect = { ...direct, parent_id: null, variant_name: null }
    const result = await resolveMarker(
      { name: 'Total bilirubin', unit: 'mg/dL', loinc_code: '1975-2' }, [parent, standaloneDirect], deps()
    )
    expect(result).toEqual({ status: 'matched', biomarkerId: 'bil', via: 'ai_code' })
  })
})
