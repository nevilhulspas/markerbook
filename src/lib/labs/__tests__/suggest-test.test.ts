import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockFetchPageText,
  mockExtractLabDataFromText,
  mockLinkLabTestBiomarkers,
} = vi.hoisted(() => ({
  mockFetchPageText: vi.fn(),
  mockExtractLabDataFromText: vi.fn(),
  mockLinkLabTestBiomarkers: vi.fn(),
}))

// supabaseAdmin mock state.
let labRow: unknown = null
let existingTests: Array<{ name: string | null }> = []
let insertError: unknown = null
let insertCalls: Array<{ table: string; data: unknown }> = []

function resetState() {
  labRow = {
    id: 'lab-1',
    website: 'https://bodimed.com/en/tests-in-bodimed/',
    status: 'approved',
  }
  existingTests = []
  insertError = null
  insertCalls = []
  mockFetchPageText.mockReset()
  mockExtractLabDataFromText.mockReset()
  mockLinkLabTestBiomarkers.mockReset()
  mockFetchPageText.mockResolvedValue({ text: 'Reverse T3 60 BGN', links: [] })
  mockExtractLabDataFromText.mockResolvedValue({
    profile: { country: null, city: null, description: null },
    tests: [
      { name: 'Reverse T3', method: null, cost: 60, currency: 'BGN', sample_type: null, turnaround_days: null },
    ],
  })
  mockLinkLabTestBiomarkers.mockResolvedValue({ testsConsidered: 1, testsLinked: 0, linksInserted: 0 })
}

function createBuilder(table: string) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    gt: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: () =>
      Promise.resolve({ data: table === 'labs' ? labRow : null, error: null }),
    insert: (data: unknown) => {
      insertCalls.push({ table, data })
      return Promise.resolve({ error: table === 'lab_tests' ? insertError : null })
    },
    // Awaiting the builder directly (lab_tests select('name').eq(...)) yields rows.
    then: (resolve: (v: unknown) => unknown) =>
      resolve({ data: table === 'lab_tests' ? existingTests : null, error: null, count: 0 }),
  }
  return builder
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: (t: string) => createBuilder(t) },
}))
vi.mock('@/lib/labs/scrape', () => ({ fetchPageText: mockFetchPageText }))
vi.mock('@/lib/labs/extract-tests', () => ({
  extractLabDataFromText: mockExtractLabDataFromText,
}))
vi.mock('@/lib/labs/link-biomarkers', () => ({
  linkLabTestBiomarkers: mockLinkLabTestBiomarkers,
}))
// '@/lib/labs/domain' and '@/lib/labs/normalize' are used for real.

import { suggestLabTestFromUrl, SuggestTestError } from '@/lib/labs/suggest-test'

const ARGS = { labId: 'lab-1', url: 'https://bodimed.com/produkt/reverse-t3/', userId: 'user-1' }

describe('suggestLabTestFromUrl', () => {
  beforeEach(resetState)

  it('adds a new, non-duplicate test as approved with submitted_by', async () => {
    const result = await suggestLabTestFromUrl(ARGS)
    expect(result.added).toEqual(['Reverse T3'])
    expect(result.duplicates).toEqual([])
    const insert = insertCalls.find((c) => c.table === 'lab_tests')
    expect(insert).toBeTruthy()
    const rows = insert!.data as Array<Record<string, unknown>>
    expect(rows[0]).toMatchObject({
      lab_id: 'lab-1',
      name: 'Reverse T3',
      status: 'approved',
      submitted_by: 'user-1',
    })
    expect(mockLinkLabTestBiomarkers).toHaveBeenCalledWith({ labId: 'lab-1', onlyUnlinked: true })
    // Open-redirector defense: fetchPageText must be told to enforce the lab's
    // registrable domain on every redirect hop, not just the initial URL.
    expect(mockFetchPageText).toHaveBeenCalledWith(
      ARGS.url,
      expect.objectContaining({ enforceSameRegistrableDomain: 'bodimed.com' })
    )
  })

  it('skips a test already present (case-insensitive)', async () => {
    existingTests = [{ name: 'reverse t3' }]
    const result = await suggestLabTestFromUrl(ARGS)
    expect(result.added).toEqual([])
    expect(result.duplicates).toEqual(['Reverse T3'])
    expect(insertCalls.find((c) => c.table === 'lab_tests')).toBeUndefined()
  })

  it('throws when the page yields no tests', async () => {
    mockExtractLabDataFromText.mockResolvedValue({
      profile: { country: null, city: null, description: null },
      tests: [],
    })
    await expect(suggestLabTestFromUrl(ARGS)).rejects.toBeInstanceOf(SuggestTestError)
  })

  it('rejects when the lab is not approved (server-side gate, even if the UI hid the dialog)', async () => {
    labRow = {
      id: 'lab-1',
      website: 'https://bodimed.com/en/tests-in-bodimed/',
      status: 'pending',
    }
    await expect(suggestLabTestFromUrl(ARGS)).rejects.toBeInstanceOf(SuggestTestError)
    expect(mockFetchPageText).not.toHaveBeenCalled()
    expect(insertCalls.find((c) => c.table === 'lab_tests')).toBeUndefined()
  })

  it('rejects an off-domain URL before fetching', async () => {
    await expect(
      suggestLabTestFromUrl({ ...ARGS, url: 'https://evil.example/produkt/x/' })
    ).rejects.toBeInstanceOf(SuggestTestError)
    expect(mockFetchPageText).not.toHaveBeenCalled()
  })

  it('throws when the page cannot be read', async () => {
    mockFetchPageText.mockResolvedValue({ text: '', links: [] })
    await expect(suggestLabTestFromUrl(ARGS)).rejects.toBeInstanceOf(SuggestTestError)
  })

  it('adds all non-duplicate tests from a multi-test page', async () => {
    existingTests = [{ name: 'TSH' }]
    mockExtractLabDataFromText.mockResolvedValue({
      profile: { country: null, city: null, description: null },
      tests: [
        { name: 'TSH', method: null, cost: null, currency: null, sample_type: null, turnaround_days: null },
        { name: 'Reverse T3', method: null, cost: null, currency: null, sample_type: null, turnaround_days: null },
        { name: 'free T4', method: null, cost: null, currency: null, sample_type: null, turnaround_days: null },
      ],
    })
    const result = await suggestLabTestFromUrl(ARGS)
    expect(result.added).toEqual(['Reverse T3', 'free T4'])
    expect(result.duplicates).toEqual(['TSH'])
  })

  it('still succeeds when biomarker linking fails', async () => {
    mockLinkLabTestBiomarkers.mockRejectedValue(new Error('link boom'))
    const result = await suggestLabTestFromUrl(ARGS)
    expect(result.added).toEqual(['Reverse T3'])
  })
})
