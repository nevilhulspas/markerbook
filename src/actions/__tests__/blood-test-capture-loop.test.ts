import { describe, it, expect, vi, beforeEach } from 'vitest'

// Pins the marker-capture loop shared by createBloodTest, updateBloodTest and
// appendResultsToBloodTest: which commit calls run (and in what order), the
// LOINC / custom-name de-dupe per path, the test_results rows written, unit
// canonicalisation, and every error result.

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGetUser, mockRevalidatePath, mockCommitCapture, mockCommitCustomCapture } =
  vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockRevalidatePath: vi.fn(),
    mockCommitCapture: vi.fn(),
    mockCommitCustomCapture: vi.fn(),
  }))

type DbError = { message: string } | null

// Configurable responses, reset before every test.
let state: {
  existingTest: { id: string } | null
  existingResults: Array<{ id: string; biomarker_id: string }>
  existingResultsError: DbError
  bloodTestInsert: { data: { id: string } | null; error: DbError }
  bloodTestUpdateError: DbError
  bmUnits: Array<{ biomarker_id: string; unit: string }>
  bmUnitsError: DbError
  resultsInsertError: DbError
  resultsUpdateError: DbError
  resultsDeleteError: DbError
}

// Every call in order, plus the payloads written.
let events: string[] = []
let bloodTestInserts: Array<Record<string, unknown>> = []
let bloodTestUpdates: Array<{ patch: Record<string, unknown>; id: string }> = []
let bloodTestDeletes: string[] = []
let bmUnitQueries: Array<{ columns: string; ids: string[] }> = []
let existingResultQueries: Array<{ testId: string; ids: string[] }> = []
let resultInserts: Array<Record<string, unknown>[]> = []
let resultUpdates: Array<{ patch: Record<string, unknown>; id: string }> = []
let resultDeletes: string[] = []

function reset() {
  state = {
    existingTest: { id: 'test-1' },
    existingResults: [],
    existingResultsError: null,
    bloodTestInsert: { data: { id: 'test-1' }, error: null },
    bloodTestUpdateError: null,
    bmUnits: [],
    bmUnitsError: null,
    resultsInsertError: null,
    resultsUpdateError: null,
    resultsDeleteError: null,
  }
  events = []
  bloodTestInserts = []
  bloodTestUpdates = []
  bloodTestDeletes = []
  bmUnitQueries = []
  existingResultQueries = []
  resultInserts = []
  resultUpdates = []
  resultDeletes = []
}

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))

vi.mock('@/lib/supabase/server', () => ({
  // RLS-scoped client: auth, the ownership read and append's existing-results read.
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === 'blood_tests') {
        return {
          select: () => ({
            eq: () => ({
              single: () => {
                events.push('rls:blood_tests.select')
                return Promise.resolve({ data: state.existingTest, error: null })
              },
            }),
          }),
        }
      }
      // test_results
      return {
        select: () => ({
          eq: (_col: string, testId: string) => ({
            in: (_col2: string, ids: string[]) => {
              events.push('rls:test_results.select')
              existingResultQueries.push({ testId, ids })
              return Promise.resolve(
                state.existingResultsError
                  ? { data: null, error: state.existingResultsError }
                  : { data: state.existingResults, error: null }
              )
            },
          }),
        }),
      }
    },
  })),
}))

vi.mock('@/lib/loinc/resolve', () => ({
  commitCapture: mockCommitCapture,
  commitCustomCapture: mockCommitCustomCapture,
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'blood_tests') {
        return {
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: () => {
                events.push('admin:blood_tests.insert')
                bloodTestInserts.push(row)
                return Promise.resolve(state.bloodTestInsert)
              },
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: (_col: string, id: string) => {
              events.push('admin:blood_tests.update')
              bloodTestUpdates.push({ patch, id })
              return Promise.resolve({ error: state.bloodTestUpdateError })
            },
          }),
          delete: () => ({
            eq: (_col: string, id: string) => {
              events.push('admin:blood_tests.delete')
              bloodTestDeletes.push(id)
              return Promise.resolve({ error: null })
            },
          }),
        }
      }
      if (table === 'biomarker_units') {
        return {
          select: (columns: string) => ({
            in: (_col: string, ids: string[]) => {
              events.push('admin:biomarker_units.select')
              bmUnitQueries.push({ columns, ids })
              return Promise.resolve(
                state.bmUnitsError
                  ? { data: null, error: state.bmUnitsError }
                  : { data: state.bmUnits, error: null }
              )
            },
          }),
        }
      }
      // test_results
      return {
        insert: (rows: Record<string, unknown>[]) => {
          events.push('admin:test_results.insert')
          resultInserts.push(rows)
          return Promise.resolve({ error: state.resultsInsertError })
        },
        update: (patch: Record<string, unknown>) => ({
          eq: (_col: string, id: string) => {
            events.push('admin:test_results.update')
            resultUpdates.push({ patch, id })
            return Promise.resolve({ error: state.resultsUpdateError })
          },
        }),
        delete: () => ({
          eq: (_col: string, id: string) => {
            events.push('admin:test_results.delete')
            resultDeletes.push(id)
            return Promise.resolve({ error: state.resultsDeleteError })
          },
        }),
      }
    }),
  },
}))

// Anthropic is never reached (the commit fns are mocked) but the module graph
// imports it — stub so no real client is constructed.
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: vi.fn() }
  },
}))

import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  appendResultsToBloodTest,
  createBloodTest,
  updateBloodTest,
} from '../blood-tests'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BM_A = '11111111-1111-4111-8111-111111111111'
const BM_B = '22222222-2222-4222-8222-222222222222'

const meta = {
  name: 'Lab report',
  test_date: '2026-05-01',
  sample_type: 'serum' as const,
}

// One of each entry kind, in a fixed order.
const mixedMarkers = [
  { biomarker_id: BM_A, value: 1, unit: 'ng/mL' },
  {
    capture_loinc_code: '1234-5',
    name: 'Loinc Marker',
    value: 2,
    unit: 'mg/L',
    ref_range_low: 0.5,
    ref_range_high: 3,
  },
  {
    capture_custom: true as const,
    name: 'My Marker',
    value: 3,
    unit: 'U/L',
    ref_range_low: null,
    ref_range_high: 10,
  },
]

const mixedCommitEvents = ['commitCapture 1234-5', 'commitCustomCapture My Marker']

function expectMixedCommitCalls() {
  expect(mockCommitCapture).toHaveBeenCalledTimes(1)
  expect(mockCommitCapture.mock.calls[0][0]).toBe('1234-5')
  expect(mockCommitCapture.mock.calls[0][1]).toEqual({
    name: 'Loinc Marker',
    unit: 'mg/L',
    ref_range_low: 0.5,
    ref_range_high: 3,
  })
  expect(mockCommitCapture.mock.calls[0][2]).toEqual({ db: supabaseAdmin })
  expect(mockCommitCapture.mock.calls[0][2].db).toBe(supabaseAdmin)

  expect(mockCommitCustomCapture).toHaveBeenCalledTimes(1)
  expect(mockCommitCustomCapture.mock.calls[0][0]).toEqual({
    name: 'My Marker',
    unit: 'U/L',
    ref_range_low: null,
    ref_range_high: 10,
  })
  expect(mockCommitCustomCapture.mock.calls[0][1].db).toBe(supabaseAdmin)
}

beforeEach(() => {
  vi.clearAllMocks()
  reset()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockRevalidatePath.mockImplementation((path: string) => {
    events.push(`revalidate ${path}`)
  })
  mockCommitCapture.mockImplementation(async (code: string) => {
    events.push(`commitCapture ${code}`)
    return `bm-loinc-${code}`
  })
  mockCommitCustomCapture.mockImplementation(async (marker: { name: string }) => {
    events.push(`commitCustomCapture ${marker.name}`)
    return `bm-custom-${marker.name.trim().toLowerCase()}`
  })
})

// ---------------------------------------------------------------------------
// createBloodTest
// ---------------------------------------------------------------------------

describe('createBloodTest — capture loop', () => {
  it('resolves mixed entries in input order and writes one row per entry', async () => {
    const res = await createBloodTest({ ...meta, markers: mixedMarkers })

    expect(res).toEqual({ success: true, testId: 'test-1', error: null })
    expectMixedCommitCalls()
    expect(events).toEqual([
      ...mixedCommitEvents,
      'admin:blood_tests.insert',
      'admin:biomarker_units.select',
      'admin:test_results.insert',
      'revalidate /tests',
      'revalidate /grid',
    ])
    expect(bloodTestInserts).toEqual([
      {
        user_id: 'u1',
        name: 'Lab report',
        test_date: '2026-05-01',
        sample_type: 'serum',
        notes: null,
        pdf_storage_path: null,
      },
    ])
    expect(bmUnitQueries).toEqual([
      { columns: 'biomarker_id, unit', ids: [BM_A, 'bm-loinc-1234-5', 'bm-custom-my marker'] },
    ])
    expect(resultInserts).toEqual([
      [
        { blood_test_id: 'test-1', biomarker_id: BM_A, value: 1, unit: 'ng/mL' },
        { blood_test_id: 'test-1', biomarker_id: 'bm-loinc-1234-5', value: 2, unit: 'mg/L' },
        { blood_test_id: 'test-1', biomarker_id: 'bm-custom-my marker', value: 3, unit: 'U/L' },
      ],
    ])
  })

  // Intentional best-effort (OTH-71 item 20): the biomarker_units lookup only
  // fixes a unit's spelling. The results ARE written, with the units as
  // submitted, so success is the truth. Failing instead would, in
  // updateBloodTest, run after the old results were deleted and empty the test.
  it('logs a biomarker_units read failure and saves the submitted units', async () => {
    state.bmUnitsError = { message: 'units read failed' }
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await createBloodTest({
      ...meta,
      markers: [{ biomarker_id: BM_A, value: 1, unit: 'umol/l' }],
    })

    expect(res.success).toBe(true)
    expect(resultInserts).toEqual([
      [{ blood_test_id: 'test-1', biomarker_id: BM_A, value: 1, unit: 'umol/l' }],
    ])
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('biomarker_units'),
      'units read failed'
    )
    logged.mockRestore()
  })

  it('rewrites units to the canonical biomarker_units spelling, keeping unmatched units raw', async () => {
    state.bmUnits = [
      { biomarker_id: BM_A, unit: 'nmol/L' },
      { biomarker_id: BM_A, unit: 'µmol/L' },
      { biomarker_id: BM_B, unit: 'g/L' },
    ]

    await createBloodTest({
      ...meta,
      markers: [
        { biomarker_id: BM_A, value: 1, unit: 'umol/l' },
        { biomarker_id: BM_B, value: 2, unit: 'mg/dL' },
      ],
    })

    expect(resultInserts).toEqual([
      [
        { blood_test_id: 'test-1', biomarker_id: BM_A, value: 1, unit: 'µmol/L' },
        { blood_test_id: 'test-1', biomarker_id: BM_B, value: 2, unit: 'mg/dL' },
      ],
    ])
  })

  it('commits a repeated LOINC code once, then rejects the per-test duplicate before any write', async () => {
    const res = await createBloodTest({
      ...meta,
      markers: [
        { capture_loinc_code: '1234-5', name: 'A', value: 1, unit: 'mg/L' },
        { capture_loinc_code: '1234-5', name: 'B', value: 2, unit: 'mg/L' },
      ],
    })

    expect(mockCommitCapture).toHaveBeenCalledTimes(1)
    expect(mockCommitCapture.mock.calls[0][1]).toMatchObject({ name: 'A' })
    expect(res).toEqual({
      success: false,
      testId: null,
      error: 'Each biomarker can only be saved once per test. Remove duplicate selections and try again.',
    })
    expect(events).toEqual(['commitCapture 1234-5'])
  })

  it('commits a repeated custom name once (trimmed, case-insensitive), passing the raw first name', async () => {
    const res = await createBloodTest({
      ...meta,
      markers: [
        { capture_custom: true, name: '  Odd Marker ', value: 1, unit: 'U/L' },
        { capture_custom: true, name: 'odd marker', value: 2, unit: 'U/L' },
      ],
    })

    expect(mockCommitCustomCapture).toHaveBeenCalledTimes(1)
    expect(mockCommitCustomCapture.mock.calls[0][0]).toMatchObject({ name: '  Odd Marker ' })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/only be saved once per test/)
    expect(events).toEqual(['commitCustomCapture   Odd Marker '])
  })

  it('rejects a repeated biomarker_id without committing anything', async () => {
    const res = await createBloodTest({
      ...meta,
      markers: [
        { biomarker_id: BM_A, value: 1, unit: 'mg/L' },
        { biomarker_id: BM_A, value: 2, unit: 'mg/L' },
      ],
    })

    expect(res.success).toBe(false)
    expect(mockCommitCapture).not.toHaveBeenCalled()
    expect(mockCommitCustomCapture).not.toHaveBeenCalled()
    expect(events).toEqual([])
  })

  it('stops at the first failing capture: later entries are not committed and nothing is written', async () => {
    mockCommitCustomCapture.mockRejectedValueOnce(new Error('boom'))

    const res = await createBloodTest({
      ...meta,
      markers: [
        { capture_loinc_code: '1234-5', value: 1, unit: 'mg/L' },
        { capture_custom: true, name: 'Bad', value: 2, unit: 'U/L' },
        { capture_loinc_code: '9999-9', value: 3, unit: 'mg/L' },
      ],
    })

    expect(res).toEqual({
      success: false,
      testId: null,
      error: 'Failed to create custom marker "Bad": boom',
    })
    expect(mockCommitCapture).toHaveBeenCalledTimes(1)
    expect(mockCommitCapture.mock.calls[0][0]).toBe('1234-5')
    expect(events).toEqual(['commitCapture 1234-5'])
  })

  it('stringifies a non-Error LOINC capture failure', async () => {
    mockCommitCapture.mockRejectedValueOnce('plain failure')

    const res = await createBloodTest({
      ...meta,
      markers: [{ capture_loinc_code: '1234-5', value: 1, unit: 'mg/L' }],
    })

    expect(res).toEqual({
      success: false,
      testId: null,
      error: 'Failed to create catalog entry for LOINC 1234-5: plain failure',
    })
    expect(events).toEqual([])
  })

  it('does not commit anything when signed out', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await createBloodTest({ ...meta, markers: mixedMarkers })

    expect(res).toEqual({ success: false, testId: null, error: 'Not authenticated' })
    expect(mockCommitCapture).not.toHaveBeenCalled()
    expect(mockCommitCustomCapture).not.toHaveBeenCalled()
  })

  it('rolls back the blood_tests row when the results insert fails', async () => {
    state.resultsInsertError = { message: 'insert failed' }

    const res = await createBloodTest({
      ...meta,
      markers: [{ biomarker_id: BM_A, value: 1, unit: 'mg/L' }],
    })

    expect(res).toEqual({ success: false, testId: null, error: 'insert failed' })
    expect(bloodTestDeletes).toEqual(['test-1'])
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('falls back to a generic message when the results insert error has none', async () => {
    state.resultsInsertError = { message: '' }

    const res = await createBloodTest({
      ...meta,
      markers: [{ biomarker_id: BM_A, value: 1, unit: 'mg/L' }],
    })

    expect(res).toEqual({ success: false, testId: null, error: 'Failed to save marker results' })
  })
})

// ---------------------------------------------------------------------------
// updateBloodTest
// ---------------------------------------------------------------------------

describe('updateBloodTest — capture loop', () => {
  it('commits every capture before mutating, then replaces the rows in input order', async () => {
    const res = await updateBloodTest('test-1', { ...meta, markers: mixedMarkers })

    expect(res).toEqual({ success: true, error: null })
    expectMixedCommitCalls()
    expect(events).toEqual([
      'rls:blood_tests.select',
      ...mixedCommitEvents,
      'admin:blood_tests.update',
      'admin:test_results.delete',
      'admin:biomarker_units.select',
      'admin:test_results.insert',
      'revalidate /tests',
      'revalidate /grid',
    ])
    expect(bloodTestUpdates).toEqual([
      {
        id: 'test-1',
        patch: {
          name: 'Lab report',
          test_date: '2026-05-01',
          sample_type: 'serum',
          notes: null,
          updated_at: expect.any(String),
        },
      },
    ])
    expect(resultDeletes).toEqual(['test-1'])
    expect(bmUnitQueries).toEqual([
      { columns: 'biomarker_id, unit', ids: [BM_A, 'bm-loinc-1234-5', 'bm-custom-my marker'] },
    ])
    expect(resultInserts).toEqual([
      [
        { blood_test_id: 'test-1', biomarker_id: BM_A, value: 1, unit: 'ng/mL' },
        { blood_test_id: 'test-1', biomarker_id: 'bm-loinc-1234-5', value: 2, unit: 'mg/L' },
        { blood_test_id: 'test-1', biomarker_id: 'bm-custom-my marker', value: 3, unit: 'U/L' },
      ],
    ])
  })

  it('rewrites units to the canonical biomarker_units spelling', async () => {
    state.bmUnits = [{ biomarker_id: BM_A, unit: 'µmol/L' }]

    await updateBloodTest('test-1', {
      ...meta,
      markers: [{ biomarker_id: BM_A, value: 1, unit: 'UMOL/L' }],
    })

    expect(resultInserts).toEqual([
      [{ blood_test_id: 'test-1', biomarker_id: BM_A, value: 1, unit: 'µmol/L' }],
    ])
  })

  it('commits a repeated LOINC code once, then rejects the per-test duplicate before any write', async () => {
    const res = await updateBloodTest('test-1', {
      ...meta,
      markers: [
        { capture_loinc_code: '1234-5', name: 'A', value: 1, unit: 'mg/L' },
        { capture_loinc_code: '1234-5', name: 'B', value: 2, unit: 'mg/L' },
      ],
    })

    expect(res).toEqual({
      success: false,
      error: 'Each biomarker can only be saved once per test. Remove duplicate selections and try again.',
    })
    expect(mockCommitCapture).toHaveBeenCalledTimes(1)
    // Metadata and results are untouched.
    expect(events).toEqual(['rls:blood_tests.select', 'commitCapture 1234-5'])
  })

  it('commits a repeated custom name once (trimmed, case-insensitive), then rejects the duplicate', async () => {
    const res = await updateBloodTest('test-1', {
      ...meta,
      markers: [
        { capture_custom: true, name: 'Odd Marker', value: 1, unit: 'U/L' },
        { capture_custom: true, name: ' ODD MARKER', value: 2, unit: 'U/L' },
      ],
    })

    expect(mockCommitCustomCapture).toHaveBeenCalledTimes(1)
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/only be saved once per test/)
    expect(resultInserts).toEqual([])
  })

  it('rejects a repeated biomarker_id without committing or writing anything', async () => {
    const res = await updateBloodTest('test-1', {
      ...meta,
      markers: [
        { biomarker_id: BM_A, value: 1, unit: 'mg/L' },
        { biomarker_id: BM_A, value: 2, unit: 'mg/L' },
      ],
    })

    expect(res.success).toBe(false)
    expect(mockCommitCapture).not.toHaveBeenCalled()
    expect(events).toEqual(['rls:blood_tests.select'])
  })

  it('leaves metadata and results untouched when a custom capture fails', async () => {
    mockCommitCustomCapture.mockRejectedValueOnce(new Error('boom'))

    const res = await updateBloodTest('test-1', { ...meta, markers: mixedMarkers })

    expect(res).toEqual({ success: false, error: 'Failed to create custom marker "My Marker": boom' })
    expect(events).toEqual(['rls:blood_tests.select', 'commitCapture 1234-5'])
  })

  it('stringifies a non-Error LOINC capture failure', async () => {
    mockCommitCapture.mockRejectedValueOnce('plain failure')

    const res = await updateBloodTest('test-1', { ...meta, markers: mixedMarkers })

    expect(res).toEqual({
      success: false,
      error: 'Failed to create catalog entry for LOINC 1234-5: plain failure',
    })
    expect(mockCommitCustomCapture).not.toHaveBeenCalled()
    expect(events).toEqual(['rls:blood_tests.select'])
  })

  it('does not commit anything when the test is not found', async () => {
    state.existingTest = null

    const res = await updateBloodTest('test-1', { ...meta, markers: mixedMarkers })

    expect(res).toEqual({ success: false, error: 'Test not found' })
    expect(mockCommitCapture).not.toHaveBeenCalled()
    expect(mockCommitCustomCapture).not.toHaveBeenCalled()
  })

  it('returns a generic message when the results insert fails', async () => {
    state.resultsInsertError = { message: 'insert failed' }

    const res = await updateBloodTest('test-1', { ...meta, markers: mixedMarkers })

    expect(res).toEqual({ success: false, error: 'Failed to save marker results' })
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// appendResultsToBloodTest
// ---------------------------------------------------------------------------

describe('appendResultsToBloodTest — capture loop', () => {
  it('commits captures, then updates existing rows and inserts the rest', async () => {
    state.existingResults = [{ id: 'r-A', biomarker_id: BM_A }]
    state.bmUnits = [{ biomarker_id: BM_A, unit: 'µmol/L' }]

    const res = await appendResultsToBloodTest('test-1', [
      { ...mixedMarkers[0], unit: 'umol/l' },
      mixedMarkers[1],
      mixedMarkers[2],
    ])

    expect(res).toEqual({ success: true, testId: 'test-1', added: 2, replaced: 1, error: null })
    expectMixedCommitCalls()
    expect(events).toEqual([
      'rls:blood_tests.select',
      ...mixedCommitEvents,
      'rls:test_results.select',
      'admin:biomarker_units.select',
      'admin:test_results.update',
      'admin:test_results.insert',
      'revalidate /tests',
      'revalidate /tests/test-1',
      'revalidate /grid',
    ])
    const ids = [BM_A, 'bm-loinc-1234-5', 'bm-custom-my marker']
    expect(existingResultQueries).toEqual([{ testId: 'test-1', ids }])
    expect(bmUnitQueries).toEqual([{ columns: 'biomarker_id, unit', ids }])
    expect(resultUpdates).toEqual([{ id: 'r-A', patch: { value: 1, unit: 'µmol/L' } }])
    expect(resultInserts).toEqual([
      [
        { blood_test_id: 'test-1', biomarker_id: 'bm-loinc-1234-5', value: 2, unit: 'mg/L' },
        { blood_test_id: 'test-1', biomarker_id: 'bm-custom-my marker', value: 3, unit: 'U/L' },
      ],
    ])
  })

  it('commits a repeated LOINC code once, keeping the last value', async () => {
    const res = await appendResultsToBloodTest('test-1', [
      { capture_loinc_code: '1234-5', name: 'A', value: 1, unit: 'mg/L' },
      { capture_loinc_code: '1234-5', name: 'B', value: 2, unit: 'mg/L' },
    ])

    expect(mockCommitCapture).toHaveBeenCalledTimes(1)
    expect(mockCommitCapture.mock.calls[0][1]).toMatchObject({ name: 'A' })
    // Both resolve to the same biomarker; the payload de-dupe keeps the last one.
    expect(res).toEqual({ success: true, testId: 'test-1', added: 1, replaced: 0, error: null })
    expect(resultInserts).toEqual([
      [{ blood_test_id: 'test-1', biomarker_id: 'bm-loinc-1234-5', value: 2, unit: 'mg/L' }],
    ])
  })

  it('returns the read error instead of inserting when the existing-results lookup fails', async () => {
    state.existingResultsError = { message: 'read failed' }

    const res = await appendResultsToBloodTest('test-1', [
      { biomarker_id: BM_A, value: 1, unit: 'mg/L' },
    ])

    expect(res).toEqual({ success: false, testId: null, added: 0, replaced: 0, error: 'read failed' })
    expect(resultInserts).toEqual([])
    expect(resultUpdates).toEqual([])
  })

  it('commits a repeated custom name once (trimmed, case-insensitive)', async () => {
    await appendResultsToBloodTest('test-1', [
      { capture_custom: true, name: 'Odd Marker', value: 1, unit: 'U/L' },
      { capture_custom: true, name: 'odd marker ', value: 2, unit: 'U/L' },
    ])

    expect(mockCommitCustomCapture).toHaveBeenCalledTimes(1)
    expect(resultInserts).toEqual([
      [{ blood_test_id: 'test-1', biomarker_id: 'bm-custom-odd marker', value: 2, unit: 'U/L' }],
    ])
  })

  it('keeps the last value per biomarker at the position of its first occurrence', async () => {
    const res = await appendResultsToBloodTest('test-1', [
      { biomarker_id: BM_A, value: 1, unit: 'mg/L' },
      { biomarker_id: BM_B, value: 2, unit: 'mg/L' },
      { biomarker_id: BM_A, value: 3, unit: 'mg/L' },
    ])

    expect(res).toEqual({ success: true, testId: 'test-1', added: 2, replaced: 0, error: null })
    expect(resultInserts).toEqual([
      [
        { blood_test_id: 'test-1', biomarker_id: BM_A, value: 3, unit: 'mg/L' },
        { blood_test_id: 'test-1', biomarker_id: BM_B, value: 2, unit: 'mg/L' },
      ],
    ])
  })

  it('writes nothing when a capture fails', async () => {
    mockCommitCustomCapture.mockRejectedValueOnce(new Error('boom'))

    const res = await appendResultsToBloodTest('test-1', mixedMarkers)

    expect(res).toEqual({
      success: false,
      testId: null,
      added: 0,
      replaced: 0,
      error: 'Failed to create custom marker "My Marker": boom',
    })
    expect(events).toEqual(['rls:blood_tests.select', 'commitCapture 1234-5'])
  })

  it('stringifies a non-Error LOINC capture failure', async () => {
    mockCommitCapture.mockRejectedValueOnce('plain failure')

    const res = await appendResultsToBloodTest('test-1', mixedMarkers)

    expect(res).toEqual({
      success: false,
      testId: null,
      added: 0,
      replaced: 0,
      error: 'Failed to create catalog entry for LOINC 1234-5: plain failure',
    })
    expect(events).toEqual(['rls:blood_tests.select'])
  })

  it('returns early without queries for an empty payload', async () => {
    const res = await appendResultsToBloodTest('test-1', [])

    expect(res).toEqual({ success: true, testId: 'test-1', added: 0, replaced: 0, error: null })
    expect(events).toEqual(['rls:blood_tests.select'])
  })

  it('does not commit anything when the test is not found', async () => {
    state.existingTest = null

    const res = await appendResultsToBloodTest('test-1', mixedMarkers)

    expect(res).toEqual({
      success: false,
      testId: null,
      added: 0,
      replaced: 0,
      error: 'Blood test not found',
    })
    expect(mockCommitCapture).not.toHaveBeenCalled()
    expect(mockCommitCustomCapture).not.toHaveBeenCalled()
  })

  it('returns the update error message when overwriting an existing row fails', async () => {
    state.existingResults = [{ id: 'r-A', biomarker_id: BM_A }]
    state.resultsUpdateError = { message: 'update failed' }

    const res = await appendResultsToBloodTest('test-1', mixedMarkers)

    expect(res).toEqual({ success: false, testId: null, added: 0, replaced: 0, error: 'update failed' })
    expect(resultInserts).toEqual([])
  })

  it('returns the insert error message when inserting new rows fails', async () => {
    state.resultsInsertError = { message: 'insert failed' }

    const res = await appendResultsToBloodTest('test-1', mixedMarkers)

    expect(res).toEqual({ success: false, testId: null, added: 0, replaced: 0, error: 'insert failed' })
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})
