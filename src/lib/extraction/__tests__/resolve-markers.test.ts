import { describe, it, expect, vi } from 'vitest'
import type { Biomarker } from '@/lib/database.types'
import type { ExtractedMarker } from '../types'
import type { ResolveDeps } from '../resolve-markers'
import { resolveExtractedMarkers } from '../resolve-markers'

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

function makeExtractedMarker(overrides: Partial<ExtractedMarker> & Pick<ExtractedMarker, 'name' | 'value' | 'unit'>): ExtractedMarker {
  return {
    confidence: 'high',
    catalog_match: null,
    loinc_code: null,
    ref_range_low: null,
    ref_range_high: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Supabase stub builder (matches the pattern in resolve.test.ts)
// ---------------------------------------------------------------------------

function buildDbStub(responses: Record<string, unknown>, insertSpy?: { called: boolean }) {
  return {
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
        insert: () => {
          if (insertSpy) insertSpy.called = true
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
// The catalog used in all tests
// ---------------------------------------------------------------------------

const ferritinBiomarker = makeBiomarker({
  id: 'bm-ferritin',
  name: 'Ferritin',
  unit: 'ng/mL',
  loinc_code: '2276-4',
})

const catalog: Biomarker[] = [ferritinBiomarker]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveExtractedMarkers', () => {
  it('resolves an existing catalog marker via the fast path without any I/O', async () => {
    const markers: ExtractedMarker[] = [
      makeExtractedMarker({ name: 'Ferritin', value: 120, unit: 'ng/mL' }),
    ]

    // Empty db — fast path should never hit the DB for a known marker
    const db = buildDbStub({}) as never
    const deps: ResolveDeps = { db }

    const { matchedMarkers, unresolved } = await resolveExtractedMarkers(markers, catalog, deps)

    expect(matchedMarkers).toHaveLength(1)
    expect(matchedMarkers[0].matched).toBe(true)
    expect(matchedMarkers[0].biomarker_id).toBe('bm-ferritin')
    expect(unresolved).toEqual([])
  })

  it('marks a capturable marker with capture_loinc_code — does NOT write during resolve', async () => {
    // A specialty marker not in the catalog but with a LOINC code provided by Claude
    const markers: ExtractedMarker[] = [
      makeExtractedMarker({
        name: 'Transferrin receptor soluble',
        value: 1.5,
        unit: 'mg/L',
        loinc_code: '30248-9',
      }),
    ]

    const insertSpy = { called: false }
    const db = buildDbStub({
      // loinc_terms: code exists and is lab-active
      loinc_terms: {
        data: [
          {
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
          },
        ],
        error: null,
      },
      // loinc_display for clean name
      loinc_display: {
        data: [
          {
            loinc_num: '30248-9',
            clean_name: 'Soluble Transferrin Receptor',
            abbreviation: 'sTfR',
          },
        ],
        error: null,
      },
    }, insertSpy) as never

    const deps: ResolveDeps = { db }

    const { matchedMarkers, unresolved } = await resolveExtractedMarkers(
      markers,
      catalog, // Ferritin only — sTfR is not in it
      deps,
    )

    expect(matchedMarkers).toHaveLength(1)
    const m = matchedMarkers[0]

    // The marker is NOT "matched" — biomarker_id is still null
    expect(m.matched).toBe(false)
    expect(m.biomarker_id).toBeNull()

    // But it carries the LOINC proposal and clean name
    expect(m.capture_loinc_code).toBe('30248-9')
    expect(m.catalog_name).toBe('Soluble Transferrin Receptor')

    // CRITICAL: no insert ran during resolve
    expect(insertSpy.called).toBe(false)

    // It is NOT in unresolved — it has a path to be saved
    expect(unresolved).toEqual([])
  })

  it('flags a genuinely unresolvable marker as capture_custom (and reports it)', async () => {
    const junkName = 'xzqfoo-nonsense-marker-9999'
    const markers: ExtractedMarker[] = [
      makeExtractedMarker({ name: junkName, value: 0, unit: 'U/L' }),
    ]

    // searchLoinc returns nothing → no LOINC match → custom capture
    const fakeSearch = vi.fn().mockResolvedValue([])
    const db = buildDbStub({}) as never
    const deps: ResolveDeps = { db, searchLoinc: fakeSearch }

    const { matchedMarkers, unresolved } = await resolveExtractedMarkers(markers, catalog, deps)

    expect(matchedMarkers).toHaveLength(1)
    expect(matchedMarkers[0].matched).toBe(false)
    expect(matchedMarkers[0].biomarker_id).toBeNull()
    expect(matchedMarkers[0].capture_loinc_code).toBeUndefined()
    // New: it is now flagged for custom capture at save time…
    expect(matchedMarkers[0].capture_custom).toBe(true)
    // …but its name is still reported so the review UI can surface it
    expect(unresolved).toEqual([junkName])
  })

  it('does NOT flag capture_custom on a per-marker resolve failure (DB error)', async () => {
    const markers: ExtractedMarker[] = [
      makeExtractedMarker({ name: 'boom', value: 1, unit: 'U/L' }),
    ]
    // searchLoinc throws → isolated to unresolved, but NOT a custom-capture candidate
    const fakeSearch = vi.fn().mockRejectedValue(new Error('db down'))
    const db = buildDbStub({}) as never
    const deps: ResolveDeps = { db, searchLoinc: fakeSearch }

    const { matchedMarkers, unresolved } = await resolveExtractedMarkers(markers, catalog, deps)

    expect(matchedMarkers[0].capture_custom).toBeUndefined()
    expect(unresolved).toEqual(['boom'])
  })

  it('handles all three marker types together in one call', async () => {
    const markers: ExtractedMarker[] = [
      // (a) existing catalog hit — fast path
      makeExtractedMarker({ name: 'Ferritin', value: 120, unit: 'ng/mL' }),
      // (b) out-of-catalog with valid LOINC code → capturable (no write)
      makeExtractedMarker({
        name: 'Transferrin receptor soluble',
        value: 1.5,
        unit: 'mg/L',
        loinc_code: '30248-9',
      }),
      // (c) junk name, no LOINC code, no search hit → unresolved
      makeExtractedMarker({ name: 'xzqfoo-nonsense-marker-9999', value: 0, unit: 'U/L' }),
    ]

    const insertSpy = { called: false }
    const db = buildDbStub({
      loinc_terms: {
        data: [
          {
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
          },
        ],
        error: null,
      },
      loinc_display: {
        data: [{ loinc_num: '30248-9', clean_name: 'Soluble Transferrin Receptor', abbreviation: 'sTfR' }],
        error: null,
      },
    }, insertSpy) as never

    const fakeSearch = vi.fn().mockResolvedValue([])
    const deps: ResolveDeps = {
      db,
      searchLoinc: fakeSearch,
    }

    const { matchedMarkers, unresolved } = await resolveExtractedMarkers(markers, catalog, deps)

    // All three markers are present in the result
    expect(matchedMarkers).toHaveLength(3)

    // (a) Ferritin — matched via fast path
    const ferritin = matchedMarkers[0]
    expect(ferritin.matched).toBe(true)
    expect(ferritin.biomarker_id).toBe('bm-ferritin')

    // (b) sTfR — capturable (NOT matched yet, no write)
    const stfr = matchedMarkers[1]
    expect(stfr.matched).toBe(false)
    expect(stfr.biomarker_id).toBeNull()
    expect(stfr.capture_loinc_code).toBe('30248-9')
    expect(stfr.catalog_name).toBe('Soluble Transferrin Receptor')

    // (c) junk — unresolved
    const junk = matchedMarkers[2]
    expect(junk.matched).toBe(false)
    expect(junk.biomarker_id).toBeNull()
    expect(junk.capture_loinc_code).toBeUndefined()

    // unresolved array contains only the junk name (capturable is NOT unresolved)
    expect(unresolved).toEqual(['xzqfoo-nonsense-marker-9999'])

    // CRITICAL: no insert ran during resolve
    expect(insertSpy.called).toBe(false)
  })

  it('processes markers sequentially (not concurrently)', async () => {
    // Two identical out-of-catalog capturable markers — both get capture_loinc_code set
    const markers: ExtractedMarker[] = [
      makeExtractedMarker({ name: 'Transferrin receptor soluble', value: 1.5, unit: 'mg/L', loinc_code: '30248-9' }),
      makeExtractedMarker({ name: 'Transferrin receptor soluble', value: 1.6, unit: 'mg/L', loinc_code: '30248-9' }),
    ]

    const db = buildDbStub({
      loinc_terms: {
        data: [{
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
        }],
        error: null,
      },
      loinc_display: {
        data: [{ loinc_num: '30248-9', clean_name: 'Soluble Transferrin Receptor', abbreviation: 'sTfR' }],
        error: null,
      },
    }) as never

    const deps: ResolveDeps = { db }

    const { matchedMarkers, unresolved } = await resolveExtractedMarkers(markers, catalog, deps)

    expect(matchedMarkers).toHaveLength(2)
    // Both carry the capture proposal
    expect(matchedMarkers[0].capture_loinc_code).toBe('30248-9')
    expect(matchedMarkers[1].capture_loinc_code).toBe('30248-9')
    expect(unresolved).toEqual([])
  })

  it('isolates a per-marker resolve failure without aborting the rest of the parse', async () => {
    const markers: ExtractedMarker[] = [
      // (a) out-of-catalog marker whose DB read throws →
      //     resolveMarker throws → must be isolated to `unresolved`
      makeExtractedMarker({
        name: 'Exploding Marker',
        value: 1,
        unit: 'mg/L',
        loinc_code: '30248-9',
      }),
      // (b) a normal existing catalog hit that must still resolve afterwards
      makeExtractedMarker({ name: 'Ferritin', value: 120, unit: 'ng/mL' }),
    ]

    // DB throws on loinc_terms lookup (simulated by a broken stub)
    const brokenDb = {
      from(table: string) {
        if (table === 'loinc_terms') {
          throw new Error('DB connection failed')
        }
        // biomarkers table (catalog fetch) works fine
        return buildDbStub({}).from(table)
      },
    } as never

    const deps: ResolveDeps = { db: brokenDb }

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { matchedMarkers, unresolved } = await resolveExtractedMarkers(markers, catalog, deps)

    // Both markers are still present — the throw did not abort the loop
    expect(matchedMarkers).toHaveLength(2)

    // (a) the exploding marker is unmatched and listed in `unresolved`
    const exploding = matchedMarkers[0]
    expect(exploding.matched).toBe(false)
    expect(exploding.biomarker_id).toBeNull()
    expect(unresolved).toEqual(['Exploding Marker'])

    // (b) Ferritin still resolved correctly via the fast path
    const ferritin = matchedMarkers[1]
    expect(ferritin.matched).toBe(true)
    expect(ferritin.biomarker_id).toBe('bm-ferritin')

    // The failure was logged (including the marker name)
    expect(warnSpy).toHaveBeenCalled()
    expect(warnSpy.mock.calls[0][0]).toContain('Exploding Marker')

    warnSpy.mockRestore()
  })
})
