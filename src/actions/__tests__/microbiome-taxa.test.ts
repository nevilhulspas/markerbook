import { describe, it, expect, vi, beforeEach } from 'vitest'

// The live column check is covered in shared-catalog.test.ts; here the
// database is taken to have the created_by column.
vi.mock('@/lib/catalog/shared-catalog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/catalog/shared-catalog')>()),
  creatorFields: async (_db: unknown, userId: string | null | undefined) =>
    userId ? { created_by: userId } : {},
}))

// ---------------------------------------------------------------------------
// Mocks — saveMicrobiomeReport's writes into the shared microbiome_taxa table
// ---------------------------------------------------------------------------

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }))

let existingTaxa: Array<{ id: string; name: string; rank: string }> = []
let upsertCalls: Array<{ rows: Array<Record<string, unknown>>; options: Record<string, unknown> }> = []
let upsertReturns: Array<{ id: string; name: string; rank: string }> = []
let racedTaxa: Array<{ id: string; name: string; rank: string }> = []
let resultInserts: Array<Record<string, unknown>[]> = []

function reset() {
  existingTaxa = []
  upsertCalls = []
  upsertReturns = []
  racedTaxa = []
  resultInserts = []
}

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'microbiome_taxa') {
        return {
          // Full read (no filter) → existing taxa; .in('name', …) → raced rows.
          select: () => ({
            in: () => Promise.resolve({ data: racedTaxa, error: null }),
            then: (resolve: (v: unknown) => unknown) => resolve({ data: existingTaxa, error: null }),
          }),
          upsert: (rows: Array<Record<string, unknown>>, options: Record<string, unknown>) => {
            upsertCalls.push({ rows, options })
            return { select: () => Promise.resolve({ data: upsertReturns, error: null }) }
          },
        }
      }
      if (table === 'microbiome_tests') {
        return {
          insert: () => ({
            select: () => ({ single: () => Promise.resolve({ data: { id: 'mt-1' }, error: null }) }),
          }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }
      // microbiome_results / microbiome_scores
      return {
        insert: (rows: Record<string, unknown>[]) => {
          if (table === 'microbiome_results') resultInserts.push(rows)
          return Promise.resolve({ error: null })
        },
      }
    }),
  },
}))

import { saveMicrobiomeReport } from '../microbiome-import'

function result(name: string, category: 'beneficial' | 'pathogenic' | null = null) {
  return {
    name,
    rank: 'genus' as const,
    category,
    value: 1,
    unit: '%',
    ref_low: null,
    ref_high: null,
    status: 'normal' as const,
    raw_label: name,
  }
}

const test = { name: 'GI-MAP', test_date: '2026-10-01', lab_name: null, sample_type: null }

beforeEach(() => {
  vi.clearAllMocks()
  reset()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
})

describe('saveMicrobiomeReport — shared taxa', () => {
  it('inserts new taxa with ON CONFLICT DO NOTHING so existing taxa are never overwritten', async () => {
    existingTaxa = [{ id: 'tx-known', name: 'Bacteroides', rank: 'genus' }]
    upsertReturns = [{ id: 'tx-new', name: 'Akkermansia', rank: 'genus' }]

    const res = await saveMicrobiomeReport({
      extraction: {
        test,
        results: [result('Bacteroides', 'pathogenic'), result('Akkermansia', 'beneficial')],
        scores: [],
      },
    })

    expect(res.success).toBe(true)
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0].options).toMatchObject({ onConflict: 'name,rank', ignoreDuplicates: true })
    // Only the unknown taxon is written, with its creator.
    expect(upsertCalls[0].rows).toEqual([
      { name: 'Akkermansia', rank: 'genus', category: 'beneficial', created_by: 'u1' },
    ])
    expect(resultInserts[0].map((r) => r.taxon_id)).toEqual(['tx-known', 'tx-new'])
  })

  it('reads the id of a taxon another import created meanwhile', async () => {
    upsertReturns = [] // conflict → nothing returned
    racedTaxa = [{ id: 'tx-raced', name: 'Prevotella', rank: 'genus' }]

    await saveMicrobiomeReport({
      extraction: { test, results: [result('Prevotella')], scores: [] },
    })

    expect(resultInserts[0].map((r) => r.taxon_id)).toEqual(['tx-raced'])
  })

  it('cleans and length-limits taxon names', async () => {
    upsertReturns = []
    await saveMicrobiomeReport({
      extraction: { test, results: [result(`  Odd‮name ${'x'.repeat(300)}`)], scores: [] },
    })

    const name = upsertCalls[0].rows[0].name as string
    expect(name.startsWith('Odd name')).toBe(true)
    expect(name.length).toBeLessThanOrEqual(120)
  })
})
