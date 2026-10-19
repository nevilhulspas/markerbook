import { describe, it, expect, vi, beforeEach } from 'vitest'
// The per-user AI limit has its own tests (src/lib/ai/__tests__/quota.test.ts).
vi.mock('@/lib/ai/quota', () => ({
  takeAiRequest: async () => ({ ok: true }),
  aiLimitResponse: (error: string) => Response.json({ error }, { status: 429 }),
  AI_LIMIT_REACHED: 'limit',
}))

const { mockGetUser, mockRevalidatePath } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

let scanInsertError: unknown = null
let regionInsertError: unknown = null
let scanInserts: Array<Record<string, unknown>> = []
let regionInserts: Array<Record<string, unknown>[]> = []
let scanDeletes: string[] = []

function reset() {
  scanInsertError = null
  regionInsertError = null
  scanInserts = []
  regionInserts = []
  scanDeletes = []
}

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
}))
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'dexa_scans') {
        return {
          insert: (data: Record<string, unknown>) => {
            scanInserts.push(data)
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: scanInsertError ? null : { id: 'scan-1' },
                    error: scanInsertError,
                  }),
              }),
            }
          },
          delete: () => ({
            eq: (_col: string, id: string) => {
              scanDeletes.push(id)
              return Promise.resolve({ error: null })
            },
          }),
        }
      }
      // dexa_regions
      return {
        insert: (rows: Record<string, unknown>[]) => {
          regionInserts.push(rows)
          return Promise.resolve({ error: regionInsertError })
        },
      }
    }),
  },
}))

// Anthropic is only used by extractDexaReport (not under test) — stub so the
// module import doesn't construct a real client error.
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: vi.fn() }
  },
}))

import { saveDexaScan } from '../dexa-import'

const validExtraction = {
  scan: {
    scan_date: '2026-05-27', provider: 'DexaFit Sofia',
    age_years: 38.4, height_cm: 176, weight_kg: 87,
    total_mass_kg: 87.1, fat_mass_g: 22829, lean_mass_g: 61698, bmc_g: 2588,
    body_fat_pct: 26.2, visceral_fat_g: 1084,
    android_fat_pct: 37.1, gynoid_fat_pct: 27.3, android_gynoid_ratio: 1.34,
    almi: 9.9, ffmi: 20.8, bone_t_score: 0.2, bone_z_score: -0.2, total_bmd: 1.224,
  },
  regions: [
    { region: 'trunk' as const, fat_pct: 33.1, fat_mass_g: 13900, lean_mass_g: 27300, bmc_g: 719, total_mass_g: 41900, bmd: null, t_score: null, z_score: null },
  ],
}

describe('saveDexaScan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reset()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('requires authentication', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const r = await saveDexaScan({ extraction: validExtraction })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/authenticated/i)
    expect(scanInserts).toHaveLength(0)
  })

  it('inserts the scan then its regions on the happy path', async () => {
    const r = await saveDexaScan({ extraction: validExtraction, storagePath: 'u/dexa/x.pdf' })
    expect(r).toEqual({ success: true, scanId: 'scan-1', error: null })
    expect(scanInserts).toHaveLength(1)
    expect(scanInserts[0].user_id).toBe('user-1')
    expect(scanInserts[0].source).toBe('summary')
    expect(scanInserts[0].pdf_storage_path).toBe('u/dexa/x.pdf')
    expect(regionInserts[0]).toHaveLength(1)
    expect(regionInserts[0][0]).toMatchObject({ scan_id: 'scan-1', region: 'trunk' })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/body')
  })

  it('rolls back the scan when region insert fails', async () => {
    regionInsertError = { message: 'region insert failed' }
    const r = await saveDexaScan({ extraction: validExtraction })
    expect(r.success).toBe(false)
    expect(scanDeletes).toEqual(['scan-1'])
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('rejects an invalid payload before any DB call', async () => {
    const r = await saveDexaScan({
      extraction: { scan: { scan_date: '' }, regions: [] } as never,
    })
    expect(r.success).toBe(false)
    expect(scanInserts).toHaveLength(0)
  })
})
