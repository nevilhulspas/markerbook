import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGetUser, mockRevalidatePath, mockCommitCapture } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockCommitCapture: vi.fn(),
}))

// Capture what gets written/mutated so we can assert on it.
let testResultsInserts: Array<Record<string, unknown>[]> = []
let testResultsDeletes: string[] = []
let bloodTestDeletes: string[] = []
let bloodTestUpdates: Array<Record<string, unknown>> = []

function reset() {
  testResultsInserts = []
  testResultsDeletes = []
  bloodTestDeletes = []
  bloodTestUpdates = []
}

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))

vi.mock('@/lib/supabase/server', () => ({
  // RLS-scoped client: used for auth + the ownership read in updateBloodTest.
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { id: 'test-1' }, error: null }),
        }),
      }),
    }),
  })),
}))

vi.mock('@/lib/loinc/resolve', () => ({
  commitCapture: mockCommitCapture,
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'blood_tests') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'test-1' }, error: null }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: () => {
              bloodTestUpdates.push(patch)
              return Promise.resolve({ error: null })
            },
          }),
          delete: () => ({
            eq: (_col: string, id: string) => {
              bloodTestDeletes.push(id)
              return Promise.resolve({ error: null })
            },
          }),
        }
      }
      if (table === 'biomarker_units') {
        // No canonical units configured — markers keep their raw unit.
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        }
      }
      // test_results
      return {
        insert: (rows: Record<string, unknown>[]) => {
          testResultsInserts.push(rows)
          return Promise.resolve({ error: null })
        },
        delete: () => ({
          eq: (_col: string, id: string) => {
            testResultsDeletes.push(id)
            return Promise.resolve({ error: null })
          },
        }),
      }
    }),
  },
}))

// Anthropic is never reached (commitCapture is mocked) but the module graph
// imports it — stub so no real client is constructed.
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: vi.fn() }
  },
}))

import { createBloodTest, updateBloodTest } from '../blood-tests'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  reset()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
})

describe('createBloodTest — capture commit at save time', () => {
  it('commits a capture_loinc_code marker and uses the returned biomarker_id for test_results', async () => {
    mockCommitCapture.mockResolvedValue('bm-captured')

    const res = await createBloodTest({
      name: 'Lab report',
      test_date: '2026-05-01',
      sample_type: 'serum',
      markers: [
        {
          capture_loinc_code: '30248-9',
          name: 'S-Transferrine receptor',
          value: 1.5,
          unit: 'mg/L',
          ref_range_low: 0.8,
          ref_range_high: 2.2,
        },
      ],
    })

    expect(res.success).toBe(true)
    if (res.success) expect(res.testId).toBe('test-1')

    // commitCapture was invoked with the LOINC code, the raw name (for aliasing),
    // and the report-printed range so it can be preferred over the AI estimate.
    expect(mockCommitCapture).toHaveBeenCalledTimes(1)
    const [code, marker] = mockCommitCapture.mock.calls[0]
    expect(code).toBe('30248-9')
    expect(marker).toMatchObject({
      name: 'S-Transferrine receptor',
      unit: 'mg/L',
      ref_range_low: 0.8,
      ref_range_high: 2.2,
    })

    // The biomarker_id returned by commitCapture is what gets written.
    expect(testResultsInserts).toHaveLength(1)
    expect(testResultsInserts[0]).toEqual([
      { blood_test_id: 'test-1', biomarker_id: 'bm-captured', value: 1.5, unit: 'mg/L' },
    ])
  })

  it('does not call commitCapture for an already-matched biomarker_id marker', async () => {
    const res = await createBloodTest({
      name: 'Lab report',
      test_date: '2026-05-01',
      sample_type: 'serum',
      markers: [
        {
          biomarker_id: '11111111-1111-4111-8111-111111111111',
          value: 120,
          unit: 'ng/mL',
        },
      ],
    })

    expect(res.success).toBe(true)
    expect(mockCommitCapture).not.toHaveBeenCalled()
    expect(testResultsInserts[0]).toEqual([
      {
        blood_test_id: 'test-1',
        biomarker_id: '11111111-1111-4111-8111-111111111111',
        value: 120,
        unit: 'ng/mL',
      },
    ])
  })

  it('commits a shared LOINC code only once per save and surfaces the per-test duplicate', async () => {
    mockCommitCapture.mockResolvedValue('bm-captured')

    const res = await createBloodTest({
      name: 'Lab report',
      test_date: '2026-05-01',
      sample_type: 'serum',
      markers: [
        { capture_loinc_code: '30248-9', name: 'sTfR (A)', value: 1.5, unit: 'mg/L' },
        { capture_loinc_code: '30248-9', name: 'sTfR (B)', value: 1.6, unit: 'mg/L' },
      ],
    })

    // Both entries resolve to the same biomarker → only ONE commitCapture write.
    expect(mockCommitCapture).toHaveBeenCalledTimes(1)
    // The per-test biomarker-id uniqueness check then rejects the duplicate cleanly.
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/only be saved once/i)
    expect(testResultsInserts).toHaveLength(0)
  })

  it('aborts (no test_results insert) when commitCapture throws', async () => {
    mockCommitCapture.mockRejectedValue(new Error('LOINC not lab-active'))

    const res = await createBloodTest({
      name: 'Lab report',
      test_date: '2026-05-01',
      sample_type: 'serum',
      markers: [
        { capture_loinc_code: '99999-9', name: 'Mystery', value: 1, unit: 'mg/L' },
      ],
    })

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toContain('99999-9')
    // commitCapture failed before the blood_tests row was created → no result inserts
    expect(testResultsInserts).toHaveLength(0)
  })
})

describe('updateBloodTest — capture commit before mutating', () => {
  const baseValues = {
    name: 'Updated report',
    test_date: '2026-05-02',
    sample_type: 'serum' as const,
  }

  it('aborts with NOTHING mutated when a capture throws (metadata + results intact)', async () => {
    mockCommitCapture.mockRejectedValue(new Error('LOINC not lab-active'))

    const res = await updateBloodTest('test-1', {
      ...baseValues,
      markers: [
        { capture_loinc_code: '99999-9', name: 'Mystery', value: 1, unit: 'mg/L' },
      ],
    })

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toContain('99999-9')

    // The capture ran before any persistent mutation — so metadata was NOT
    // updated and existing results were NOT deleted.
    expect(bloodTestUpdates).toHaveLength(0)
    expect(testResultsDeletes).toHaveLength(0)
    expect(testResultsInserts).toHaveLength(0)
  })

  it('commits a shared LOINC code only once within one update', async () => {
    mockCommitCapture.mockResolvedValue('bm-captured')

    await updateBloodTest('test-1', {
      ...baseValues,
      markers: [
        { capture_loinc_code: '30248-9', name: 'sTfR (A)', value: 1.5, unit: 'mg/L' },
        { capture_loinc_code: '30248-9', name: 'sTfR (B)', value: 1.6, unit: 'mg/L' },
      ],
    })

    // Both entries resolve to the same biomarker → only ONE commitCapture write,
    // not a redundant second one that would re-delete/re-insert on a shared code.
    expect(mockCommitCapture).toHaveBeenCalledTimes(1)
    expect(mockCommitCapture.mock.calls[0][0]).toBe('30248-9')
  })

  it('updates metadata and inserts results on a clean capture', async () => {
    mockCommitCapture.mockResolvedValue('bm-captured')

    const res = await updateBloodTest('test-1', {
      ...baseValues,
      markers: [
        { capture_loinc_code: '30248-9', name: 'sTfR', value: 1.5, unit: 'mg/L' },
      ],
    })

    expect(res.success).toBe(true)
    expect(mockCommitCapture).toHaveBeenCalledTimes(1)
    expect(bloodTestUpdates).toHaveLength(1)
    expect(bloodTestUpdates[0]).toMatchObject({ name: 'Updated report', test_date: '2026-05-02' })
    expect(testResultsDeletes).toEqual(['test-1'])
    expect(testResultsInserts).toEqual([
      [{ blood_test_id: 'test-1', biomarker_id: 'bm-captured', value: 1.5, unit: 'mg/L' }],
    ])
  })
})
