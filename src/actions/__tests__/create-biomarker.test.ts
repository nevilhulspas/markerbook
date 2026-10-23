import { describe, it, expect, vi, beforeEach } from 'vitest'

// The live column check is covered in shared-catalog.test.ts; here the
// database is taken to have the created_by column.
vi.mock('@/lib/catalog/shared-catalog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/catalog/shared-catalog')>()),
  creatorFields: async (_db: unknown, userId: string | null | undefined) =>
    userId ? { created_by: userId } : {},
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/ai/quota', () => ({ takeAiRequest: async () => ({ ok: true }) }))

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }))

let biomarkerInserts: Record<string, unknown>[] = []
let preferenceUpserts: Record<string, unknown>[] = []
let biomarkerUpdates: unknown[] = []
let insertResult: { data: unknown; error: unknown } = { data: null, error: null }
let existingRow: unknown = null

function reset() {
  biomarkerInserts = []
  preferenceUpserts = []
  biomarkerUpdates = []
  existingRow = null
}

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'user_unit_preferences') {
        return {
          upsert: (row: Record<string, unknown>) => {
            preferenceUpserts.push(row)
            return Promise.resolve({ error: null })
          },
        }
      }
      // biomarkers
      const reselect = {
        eq: () => reselect,
        is: () => reselect,
        single: () => Promise.resolve({ data: existingRow, error: null }),
      }
      return {
        insert: (row: Record<string, unknown>) => {
          biomarkerInserts.push(row)
          return {
            select: () => ({
              single: () =>
                Promise.resolve(
                  insertResult.error
                    ? insertResult
                    : { data: { id: `bm-${biomarkerInserts.length}`, ...row }, error: null }
                ),
            }),
          }
        },
        update: (patch: unknown) => {
          biomarkerUpdates.push(patch)
          return reselect
        },
        select: () => reselect,
      }
    }),
  },
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: vi.fn() }
  },
}))

import { createBiomarker, createBiomarkers } from '../blood-tests'

beforeEach(() => {
  vi.clearAllMocks()
  reset()
  insertResult = { data: null, error: null }
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createBiomarker — shared catalogue row', () => {
  it("stores a clean name and no unit; the user's unit becomes their display preference", async () => {
    const res = await createBiomarker({ name: '  AA/EPA‮ ', category: 'Fatty acids', unit: 'ratio' })

    expect(biomarkerInserts).toEqual([
      { name: 'AA/EPA', category: 'Fatty acids', unit: '', is_custom: true, created_by: 'u1' },
    ])
    expect(preferenceUpserts).toEqual([
      { user_id: 'u1', biomarker_id: 'bm-1', preferred_unit: 'ratio' },
    ])
    // The creator keeps seeing the marker in their own unit.
    expect(res.success && res.biomarker.unit).toBe('ratio')
  })

  it('caps the name length', async () => {
    await createBiomarker({ name: 'x'.repeat(500), category: 'Other', unit: 'mg/L' })
    expect((biomarkerInserts[0].name as string).length).toBe(120)
  })

  it('rejects an empty name or category', async () => {
    const res = await createBiomarker({ name: ' \u0000 ', category: 'Other', unit: 'mg/L' })
    expect(res.success).toBe(false)
    expect(biomarkerInserts).toHaveLength(0)
  })

  it('reports a duplicate name without touching the existing row', async () => {
    insertResult = { data: null, error: { code: '23505', message: 'dup' } }
    const res = await createBiomarker({ name: 'Ferritin', category: 'Iron', unit: 'ng/mL' })
    expect(res.success).toBe(false)
    expect(biomarkerUpdates).toHaveLength(0)
    expect(preferenceUpserts).toHaveLength(0)
  })
})

describe('createBiomarkers — shared catalogue rows', () => {
  it('reuses an existing live row as it is on a duplicate name', async () => {
    insertResult = { data: null, error: { code: '23505', message: 'dup' } }
    existingRow = { id: 'bm-existing', name: 'Ferritin', unit: 'ng/mL' }

    const res = await createBiomarkers([{ name: 'Ferritin', category: 'Iron', unit: 'µg/L' }])

    expect(res.success && res.biomarkers).toEqual([existingRow])
    expect(biomarkerUpdates).toHaveLength(0)
    expect(preferenceUpserts).toHaveLength(0)
  })

  it('never writes the submitted unit into a new row', async () => {
    await createBiomarkers([
      { name: 'DGLA', category: 'Fatty acids', unit: 'mg/l' },
      { name: '', category: 'Other', unit: 'x' },
    ])
    expect(biomarkerInserts).toHaveLength(1)
    expect(biomarkerInserts[0]).toMatchObject({ name: 'DGLA', unit: '', created_by: 'u1' })
  })
})
