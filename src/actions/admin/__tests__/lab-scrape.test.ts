import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockRequireAdmin,
  mockRevalidatePath,
  mockCollectLabSiteText,
  mockExtractLabDataFromText,
  mockLinkLabTestBiomarkers,
} = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockCollectLabSiteText: vi.fn(),
  mockExtractLabDataFromText: vi.fn(),
  mockLinkLabTestBiomarkers: vi.fn(),
}))

// Recorded calls for assertions.
let insertCalls: Array<{ table: string; data: unknown }> = []
let updateCalls: Array<{ table: string; data: unknown }> = []

// Controllable results keyed by intent.
let labRow: unknown = null // labs.select(...).maybeSingle() result
let existingTests: Array<{ name: string | null }> = []
let labUpdateError: unknown = null
let testInsertError: unknown = null
let activeJobRow: unknown = null // scrape_jobs ...maybeSingle() (getActiveScrapeJobId)

function resetMocks() {
  insertCalls = []
  updateCalls = []
  labRow = null
  existingTests = []
  labUpdateError = null
  testInsertError = null
  activeJobRow = null
}

/**
 * Chainable builder. select/eq/order pass through. Terminal behavior:
 *  - labs: update(...).eq() resolves to { error }, select().eq().maybeSingle()
 *    resolves to { data: labRow }
 *  - lab_tests: select('name').eq() resolves to { data: existingTests },
 *    insert(...) resolves to { error: testInsertError }
 */
function createBuilder(table: string) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    order: () => builder,
    eq: () => builder,
    gt: () => builder, // getActiveScrapeJobId: .gt('updated_at', …)
    limit: () => builder, // getActiveScrapeJobId: .limit(1)
    insert: (data: unknown) => {
      insertCalls.push({ table, data })
      return Promise.resolve({
        data: null,
        error: table === 'lab_tests' ? testInsertError : null,
      })
    },
    update: (data: unknown) => {
      updateCalls.push({ table, data })
      // update(...).eq(id) — the returned builder's eq() resolves.
      return {
        eq: () =>
          Promise.resolve({
            data: null,
            error: table === 'labs' ? labUpdateError : null,
          }),
      }
    },
    maybeSingle: () =>
      Promise.resolve({
        // scrape_jobs is only read by getActiveScrapeJobId (concurrency guard);
        // everything else reading maybeSingle is the labs lookup.
        data: table === 'scrape_jobs' ? activeJobRow : labRow,
        error: null,
      }),
    then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) => {
      // Reached by lab_tests: select('name').eq(lab_id) (no terminal method).
      const result =
        table === 'lab_tests'
          ? { data: existingTests, error: null }
          : { data: labRow, error: null }
      return Promise.resolve(result).then(resolve, reject)
    },
  }
  return builder
}

vi.mock('server-only', () => ({}))

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => createBuilder(table)),
  },
}))

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: mockRequireAdmin,
}))

vi.mock('@/lib/labs/scrape', () => ({
  collectLabSiteText: mockCollectLabSiteText,
}))

vi.mock('@/lib/labs/extract-tests', () => ({
  // The action calls extractAllLabData (chunked, whole-catalogue extractor).
  extractAllLabData: mockExtractLabDataFromText,
}))

// runLabScrape links tests to biomarkers after inserting them; stub it so these
// tests don't load the catalogue or hit the LLM.
vi.mock('@/lib/labs/link-biomarkers', () => ({
  linkLabTestBiomarkers: mockLinkLabTestBiomarkers,
}))

import { adminScrapeLab } from '../lab-scrape'

const adminUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  app_metadata: { role: 'admin' },
}

describe('adminScrapeLab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    mockRequireAdmin.mockResolvedValue(adminUser)
    mockLinkLabTestBiomarkers.mockResolvedValue({
      testsConsidered: 0,
      testsLinked: 0,
      linksInserted: 0,
    })
  })

  it('propagates a requireAdmin rejection', async () => {
    mockRequireAdmin.mockRejectedValue(
      new Error('Not authorized: admin role required')
    )

    await expect(adminScrapeLab('lab-1')).rejects.toThrow()
    expect(mockCollectLabSiteText).not.toHaveBeenCalled()
  })

  it('returns "Lab not found" when the lab does not exist', async () => {
    labRow = null

    const result = await adminScrapeLab('missing')

    expect(result).toEqual({
      inserted: 0,
      skipped: 0,
      profileUpdated: false,
      error: 'Lab not found',
    })
    expect(mockCollectLabSiteText).not.toHaveBeenCalled()
  })

  it('refuses when a fresh scrape is already running for the lab', async () => {
    activeJobRow = { id: 'job-running' } // getActiveScrapeJobId finds an in-flight job

    const result = await adminScrapeLab('lab-1')

    expect(result.error).toMatch(/already running/i)
    expect(result.inserted).toBe(0)
    // Must short-circuit before doing any scraping work.
    expect(mockCollectLabSiteText).not.toHaveBeenCalled()
  })

  it('errors when the lab has no website', async () => {
    labRow = {
      id: 'lab-1',
      name: 'Acme',
      website: null,
      country: null,
      city: null,
      description: null,
    }

    const result = await adminScrapeLab('lab-1')

    expect(result.error).toBe('Lab has no website to scrape.')
    expect(result.inserted).toBe(0)
    expect(mockCollectLabSiteText).not.toHaveBeenCalled()
  })

  it('errors when the website cannot be fetched', async () => {
    labRow = {
      id: 'lab-1',
      name: 'Acme',
      website: 'https://acme-labs.example',
      country: null,
      city: null,
      description: null,
    }
    mockCollectLabSiteText.mockResolvedValue('')

    const result = await adminScrapeLab('lab-1')

    expect(result.error).toBe('Could not fetch the lab website.')
    expect(mockExtractLabDataFromText).not.toHaveBeenCalled()
  })

  it('errors when extraction throws (message propagated)', async () => {
    labRow = {
      id: 'lab-1',
      name: 'Acme',
      website: 'https://acme-labs.example',
      country: null,
      city: null,
      description: null,
    }
    mockCollectLabSiteText.mockResolvedValue('some site text')
    mockExtractLabDataFromText.mockRejectedValue(new Error('LLM blew up'))

    const result = await adminScrapeLab('lab-1')

    // runLabScrape no longer relabels extraction failures — the action returns
    // the thrown Error's message verbatim (and never throws for these).
    expect(result.error).toBe('LLM blew up')
    expect(result.inserted).toBe(0)
  })

  it('inserts only NEW tests (dedupes case-insensitively) and fills only EMPTY profile fields', async () => {
    labRow = {
      id: 'lab-1',
      name: 'Acme',
      website: 'https://acme-labs.example',
      country: 'NL', // already set -> must NOT be overwritten
      city: null, // empty -> should be filled
      description: '', // empty string -> should be filled
    }
    existingTests = [{ name: 'Lipid Panel' }] // existing -> a scraped dup is skipped
    mockCollectLabSiteText.mockResolvedValue('lots of scraped text')
    mockExtractLabDataFromText.mockResolvedValue({
      profile: {
        country: 'BE', // ignored: country already set
        city: 'Amsterdam', // fills empty city
        description: 'A great lab.', // fills empty description
      },
      tests: [
        { name: 'lipid panel', method: null, cost: null, currency: null, sample_type: null, turnaround_days: null }, // dup of existing (case-insensitive)
        { name: 'Vitamin D', method: 'LC-MS', cost: 39.5, currency: 'EUR', sample_type: 'serum', turnaround_days: 3 },
        { name: 'Vitamin D', method: null, cost: null, currency: null, sample_type: null, turnaround_days: null }, // dup within batch
        { name: 'Ferritin', method: null, cost: null, currency: null, sample_type: null, turnaround_days: null },
      ],
    })

    const result = await adminScrapeLab('lab-1')

    // Profile update only touched the empty fields.
    const labUpdate = updateCalls.find((c) => c.table === 'labs')
    expect(labUpdate).toBeDefined()
    const patch = labUpdate!.data as Record<string, unknown>
    expect(patch.city).toBe('Amsterdam')
    expect(patch.description).toBe('A great lab.')
    expect(patch).not.toHaveProperty('country') // pre-existing value preserved
    expect(patch.updated_at).toBeDefined()

    // Tests insert: only the two new unique tests.
    const testInsert = insertCalls.find((c) => c.table === 'lab_tests')
    expect(testInsert).toBeDefined()
    const rows = testInsert!.data as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.name)).toEqual(['Vitamin D', 'Ferritin'])
    expect(rows.every((r) => r.status === 'approved')).toBe(true)
    expect(rows.every((r) => r.lab_id === 'lab-1')).toBe(true)
    const vitD = rows.find((r) => r.name === 'Vitamin D')!
    expect(vitD.cost).toBe(39.5)
    expect(vitD.currency).toBe('EUR')

    expect(result.inserted).toBe(2)
    expect(result.skipped).toBe(2) // one existing dup + one in-batch dup
    expect(result.profileUpdated).toBe(true)
    expect(result.error).toBeNull()

    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/labs')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/labs')
  })

  it('does not update the profile when no fields are empty', async () => {
    labRow = {
      id: 'lab-1',
      name: 'Acme',
      website: 'https://acme-labs.example',
      country: 'NL',
      city: 'Utrecht',
      description: 'Existing description.',
    }
    existingTests = []
    mockCollectLabSiteText.mockResolvedValue('text')
    mockExtractLabDataFromText.mockResolvedValue({
      profile: { country: 'BE', city: 'Brussels', description: 'New desc.' },
      tests: [],
    })

    const result = await adminScrapeLab('lab-1')

    expect(updateCalls.find((c) => c.table === 'labs')).toBeUndefined()
    expect(result.profileUpdated).toBe(false)
    expect(result.inserted).toBe(0)
    expect(result.error).toBeNull()
  })

  it('dedupes trivial formatting variants (en-dash / trailing period / spaces) against existing tests and within the batch', async () => {
    labRow = {
      id: 'lab-1',
      name: 'Acme',
      website: 'https://acme-labs.example',
      country: 'NL',
      city: 'Utrecht',
      description: 'Existing.',
    }
    // Existing test uses an ASCII hyphen; the scrape returns an en-dash variant.
    existingTests = [{ name: 'LDL - Cholesterol (LDL-C)' }]
    mockCollectLabSiteText.mockResolvedValue('text')
    mockExtractLabDataFromText.mockResolvedValue({
      profile: { country: null, city: null, description: null },
      tests: [
        // en-dash variant of an existing test -> skipped
        { name: 'LDL – Cholesterol (LDL-C)', method: null, cost: null, currency: null, sample_type: null, turnaround_days: null },
        { name: 'Noradrenaline - urine', method: null, cost: null, currency: null, sample_type: null, turnaround_days: null },
        // en-dash duplicate of the line above (within batch) -> skipped
        { name: 'Noradrenaline – urine', method: null, cost: null, currency: null, sample_type: null, turnaround_days: null },
        // trailing period only differs from a genuinely new name -> still inserted once
        { name: 'Vitamin D.', method: null, cost: null, currency: null, sample_type: null, turnaround_days: null },
        // genuine variant (CSF) must NOT be treated as a duplicate
        { name: 'Noradrenaline - urine CSF', method: null, cost: null, currency: null, sample_type: null, turnaround_days: null },
      ],
    })

    const result = await adminScrapeLab('lab-1')

    const testInsert = insertCalls.find((c) => c.table === 'lab_tests')
    const rows = testInsert!.data as Array<Record<string, unknown>>
    expect(rows.map((r) => r.name)).toEqual([
      'Noradrenaline - urine',
      'Vitamin D.',
      'Noradrenaline - urine CSF',
    ])
    expect(result.inserted).toBe(3)
    expect(result.skipped).toBe(2) // en-dash dup of existing + en-dash dup within batch
  })
})
