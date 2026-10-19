import { describe, it, expect, vi } from 'vitest'
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
 * 'biomarkers' table so we can assert on what was written.
 */
function buildDbStubWithInsertCapture(
  responses: Record<string, unknown>,
): { db: never; lastInsertedRow: { value: Record<string, unknown> | null } } {
  const lastInsertedRow: { value: Record<string, unknown> | null } = { value: null }

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
      }
      return chain
    },
  }

  return { db: db as never, lastInsertedRow }
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

  it('uses the printed report range when present and does NOT call estimateRange', async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      loinc_terms: { data: [activeLoincTerm], error: null },
      loinc_display: { data: [displayRow], error: null },
      'insert:biomarkers': { data: { id: 'bm-ferritin' }, error: null },
    })

    const fakeEstimateRange = vi.fn<() => Promise<ResolvedRange | null>>().mockResolvedValue({
      low: 99,
      high: 999,
      source: 'ai_estimated',
    })

    const deps: CommitCaptureDeps = { db, estimateRange: fakeEstimateRange }
    const id = await commitCapture(
      '2276-4',
      { unit: 'ng/mL', ref_range_low: 12, ref_range_high: 300 },
      deps,
    )

    expect(id).toBe('bm-ferritin')
    // estimateRange must NOT have been called (report range wins)
    expect(fakeEstimateRange).not.toHaveBeenCalled()

    // Inserted row must carry the report range + range_source
    expect(lastInsertedRow.value).toMatchObject({
      ref_range_low: 12,
      ref_range_high: 300,
      range_source: 'report',
    })
  })

  it('calls estimateRange and sets ai_estimated columns when no printed range', async () => {
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
    // estimateRange must have been called once
    expect(fakeEstimateRange).toHaveBeenCalledOnce()

    // Inserted row must carry the AI-estimated range + range_source
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

    // No range columns and range_source should be absent/undefined
    expect(lastInsertedRow.value).not.toHaveProperty('ref_range_low')
    expect(lastInsertedRow.value).not.toHaveProperty('range_source')
  })

  it('stores the raw lab name as an alias when it differs from the LOINC clean name', async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      loinc_terms: { data: [activeLoincTerm], error: null },
      loinc_display: { data: [displayRow], error: null }, // clean_name: 'Ferritin'
      'insert:biomarkers': { data: { id: 'bm-ferritin' }, error: null },
    })

    const deps: CommitCaptureDeps = { db, estimateRange: vi.fn().mockResolvedValue(null) }
    await commitCapture('2276-4', { name: 'S-Ferritine', unit: 'ng/mL' }, deps)

    // Display name comes from the LOINC clean_name; the lab's raw spelling is
    // kept as an alias so a future import of 'S-Ferritine' fast-path matches.
    expect(lastInsertedRow.value).toMatchObject({
      name: 'Ferritin',
      aliases: ['S-Ferritine'],
    })
  })

  it('does not alias the raw name when it equals the clean name', async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      loinc_terms: { data: [activeLoincTerm], error: null },
      loinc_display: { data: [displayRow], error: null }, // clean_name: 'Ferritin'
      'insert:biomarkers': { data: { id: 'bm-ferritin' }, error: null },
    })

    const deps: CommitCaptureDeps = { db, estimateRange: vi.fn().mockResolvedValue(null) }
    await commitCapture('2276-4', { name: 'Ferritin', unit: 'ng/mL' }, deps)

    expect(lastInsertedRow.value).toMatchObject({ name: 'Ferritin', aliases: [] })
  })

  it('falls back to the raw lab name (never the unit) when no LOINC clean name exists', async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      loinc_terms: { data: [activeLoincTerm], error: null },
      // no display row → no clean_name
      loinc_display: { data: [], error: null },
      'insert:biomarkers': { data: { id: 'bm-ferritin' }, error: null },
    })

    const deps: CommitCaptureDeps = { db, estimateRange: vi.fn().mockResolvedValue(null) }
    await commitCapture('2276-4', { name: 'S-Ferritine', unit: 'ng/mL' }, deps)

    // Name falls back to the raw lab name, NOT the unit ('ng/mL')
    expect(lastInsertedRow.value).toMatchObject({ name: 'S-Ferritine', unit: 'ng/mL' })
    // And since name === chosen display name, no self-alias
    expect(lastInsertedRow.value).toMatchObject({ aliases: [] })
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
  it('inserts a custom row (is_custom true, loinc_code null) and returns the id', async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      'insert:biomarkers': { data: { id: 'bm-aaepa' }, error: null },
    })

    const deps: CommitCustomCaptureDeps = { db, estimateRangeByName: vi.fn().mockResolvedValue(null) }
    const id = await commitCustomCapture({ name: 'AA/EPA', unit: 'ratio' }, deps)

    expect(id).toBe('bm-aaepa')
    expect(lastInsertedRow.value).toMatchObject({
      name: 'AA/EPA',
      unit: 'ratio',
      category: 'Other',
      loinc_code: null,
      is_custom: true,
      aliases: [],
    })
  })

  it('never calls loinc_terms/loinc_display and prefers the printed report range', async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      'insert:biomarkers': { data: { id: 'bm-amh' }, error: null },
    })
    const fakeEstimate = vi.fn<() => Promise<ResolvedRange | null>>().mockResolvedValue({
      low: 1, high: 2, source: 'ai_estimated',
    })

    const deps: CommitCustomCaptureDeps = { db, estimateRangeByName: fakeEstimate }
    await commitCustomCapture(
      { name: 'Anti-Müllerian Hormone', unit: 'ng/mL', ref_range_low: 0.147, ref_range_high: 7.49 },
      deps,
    )

    // report range wins — the name-based estimator is never consulted
    expect(fakeEstimate).not.toHaveBeenCalled()
    expect(lastInsertedRow.value).toMatchObject({
      is_custom: true,
      ref_range_low: 0.147,
      ref_range_high: 7.49,
      range_source: 'report',
    })
  })

  it('falls back to a name-based AI estimate when no report range is present', async () => {
    const { db, lastInsertedRow } = buildDbStubWithInsertCapture({
      'insert:biomarkers': { data: { id: 'bm-dgla' }, error: null },
    })
    const fakeEstimate = vi.fn<() => Promise<ResolvedRange | null>>().mockResolvedValue({
      low: 30, high: 90, source: 'ai_estimated',
    })

    const deps: CommitCustomCaptureDeps = { db, estimateRangeByName: fakeEstimate, ai: {} as unknown as Anthropic }
    await commitCustomCapture({ name: 'DGLA', unit: 'mg/l' }, deps)

    expect(fakeEstimate).toHaveBeenCalledOnce()
    expect(lastInsertedRow.value).toMatchObject({
      ref_range_low: 30,
      ref_range_high: 90,
      range_source: 'ai_estimated',
    })
  })

  it('re-selects the existing row on a 23505 name unique-violation', async () => {
    const db = buildDbStub({
      'insert:biomarkers': { data: null, error: { code: '23505' } },
      // post-conflict re-select by name (.eq('name').is('archived_at', null).single())
      biomarkers: { data: { id: 'existing-custom' }, error: null },
    }) as never

    const deps: CommitCustomCaptureDeps = { db, estimateRangeByName: vi.fn().mockResolvedValue(null) }
    const id = await commitCustomCapture({ name: 'AA/EPA', unit: 'ratio' }, deps)

    expect(id).toBe('existing-custom')
  })

  it('throws when the marker name is empty', async () => {
    const { db } = buildDbStubWithInsertCapture({})
    const deps: CommitCustomCaptureDeps = { db, estimateRangeByName: vi.fn().mockResolvedValue(null) }
    await expect(commitCustomCapture({ name: '   ', unit: 'ratio' }, deps)).rejects.toThrow(
      /name is required/,
    )
  })
})
