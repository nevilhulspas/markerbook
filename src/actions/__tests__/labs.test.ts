import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom, mockGetUser } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
  })),
}))

// labs.ts imports these `server-only` modules at the top (for submitLab /
// getLabDetail's submitter fallback); stub them so the suite — which only
// exercises the read paths — can import the module in vitest's client env.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/labs/run-scrape', () => ({ runScrapeJob: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: { from: vi.fn() } }))

import {
  getApprovedLabs,
  getApprovedLabsWithTestCount,
  getLabDetail,
  getLabsForBiomarker,
} from '@/actions/labs'

beforeEach(() => {
  vi.clearAllMocks()
  // Default: no signed-in user. getLabDetail's not-found path returns null at
  // the auth check, before the supabaseAdmin submitter fallback.
  mockGetUser.mockResolvedValue({ data: { user: null } })
})

describe('getApprovedLabs', () => {
  it('returns the data rows as Lab[]', async () => {
    const rows = [
      { id: 'l1', name: 'Acme', status: 'approved' },
      { id: 'l2', name: 'Beta', status: 'approved' },
    ]
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: rows }),
        }),
      }),
    })

    const labs = await getApprovedLabs()
    expect(labs).toEqual(rows)
  })

  it('returns [] when data is null', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: null }),
        }),
      }),
    })

    expect(await getApprovedLabs()).toEqual([])
  })

  it('applies the country filter when opts.country is set', async () => {
    const countryEq = vi.fn(() => Promise.resolve({ data: [{ id: 'l1' }] }))
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({ eq: countryEq }),
        }),
      }),
    })

    const labs = await getApprovedLabs({ country: 'NL' })
    expect(countryEq).toHaveBeenCalledWith('country', 'NL')
    expect(labs).toEqual([{ id: 'l1' }])
  })
})

describe('getApprovedLabsWithTestCount', () => {
  it('maps the embedded count onto testCount', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [
                {
                  id: 'l1',
                  name: 'Acme',
                  status: 'approved',
                  lab_tests: [{ id: 't1' }, { id: 't2' }, { id: 't3' }],
                },
              ],
            }),
        }),
      }),
    })

    const labs = await getApprovedLabsWithTestCount()
    expect(labs).toEqual({
      data: [{ id: 'l1', name: 'Acme', status: 'approved', testCount: 3 }],
      error: null,
    })
  })

  it('defaults testCount to 0 when no count row is present', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [{ id: 'l1', name: 'Acme', status: 'approved', lab_tests: [] }],
            }),
        }),
      }),
    })

    const labs = await getApprovedLabsWithTestCount()
    expect(labs).toEqual({
      data: [{ id: 'l1', name: 'Acme', status: 'approved', testCount: 0 }],
      error: null,
    })
  })

  it('returns [] when data is null', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: null }),
        }),
      }),
    })

    expect(await getApprovedLabsWithTestCount()).toEqual({ data: [], error: null })
  })

  it('returns the query error instead of an empty list', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: null, error: { message: 'db down' } }),
        }),
      }),
    })

    expect(await getApprovedLabsWithTestCount()).toEqual({
      data: null,
      error: 'Could not load the labs. Please try again.',
    })
  })

  it('applies the country filter when opts.country is set', async () => {
    const countryEq = vi.fn(() => Promise.resolve({ data: [] }))
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({ eq: countryEq }),
        }),
      }),
    })

    await getApprovedLabsWithTestCount({ country: 'NL' })
    expect(countryEq).toHaveBeenCalledWith('country', 'NL')
  })
})

describe('getLabDetail', () => {
  it('returns null when the lab is not found', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'labs') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null }),
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    })

    expect(await getLabDetail('missing')).toBeNull()
  })

  it('flattens nested biomarkers on tests', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'labs') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { id: 'l1', name: 'Acme', status: 'approved' },
                  }),
              }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: 't1',
                      name: 'Ferritin',
                      lab_test_biomarkers: [
                        {
                          biomarkers: {
                            id: 'b1',
                            name: 'Ferritin',
                            short_name: 'FER',
                          },
                        },
                      ],
                    },
                  ],
                }),
            }),
          }),
        }),
      }
    })

    const detail = await getLabDetail('l1')
    expect(detail?.lab).toEqual({ id: 'l1', name: 'Acme', status: 'approved' })
    expect(detail?.tests[0].biomarkers).toEqual([
      { id: 'b1', name: 'Ferritin', short_name: 'FER' },
    ])
  })

  it('drops null biomarkers when flattening', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'labs') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: { id: 'l1', name: 'Acme' } }),
              }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: 't1',
                      name: 'Test',
                      lab_test_biomarkers: [
                        { biomarkers: null },
                        {
                          biomarkers: {
                            id: 'b2',
                            name: 'Iron',
                            short_name: null,
                          },
                        },
                      ],
                    },
                  ],
                }),
            }),
          }),
        }),
      }
    })

    const detail = await getLabDetail('l1')
    expect(detail?.tests[0].biomarkers).toEqual([
      { id: 'b2', name: 'Iron', short_name: null },
    ])
  })
})

describe('getLabsForBiomarker', () => {
  it('maps a joined row to a LabOfferingForBiomarker', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [
              {
                lab_tests: {
                  id: 't1',
                  name: 'Ferritin panel',
                  method: 'ELISA',
                  cost: 25,
                  currency: 'EUR',
                  labs: {
                    id: 'l1',
                    name: 'Acme',
                    country: 'NL',
                    city: 'Amsterdam',
                  },
                },
              },
            ],
          }),
      }),
    })

    const offerings = await getLabsForBiomarker('b1')
    expect(offerings.error).toBeNull()
    expect(offerings.data).toEqual([
      {
        labId: 'l1',
        labName: 'Acme',
        country: 'NL',
        city: 'Amsterdam',
        testId: 't1',
        testName: 'Ferritin panel',
        method: 'ELISA',
        cost: 25,
        currency: 'EUR',
      },
    ])
  })

  it('returns [] when data is null', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ data: null }),
      }),
    })

    expect(await getLabsForBiomarker('b1')).toEqual({ data: [], error: null })
  })

  it('returns the query error instead of an empty list', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ data: null, error: { message: 'db down' } }),
      }),
    })

    expect(await getLabsForBiomarker('b1')).toEqual({
      data: null,
      error: 'Could not load the labs for this marker. Please try again.',
    })
  })
})

describe('review fields stay private', () => {
  // Signed-in users may not read who submitted or reviewed a lab or test (the
  // column grants refuse it), so the user-facing reads must name their columns.
  function recordSelects(row: unknown) {
    const selects: string[] = []
    const chain: Record<string, unknown> = {
      select: (cols: string) => {
        selects.push(cols)
        return chain
      },
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      maybeSingle: () => Promise.resolve({ data: row, error: null }),
      then: (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null }),
    }
    mockFrom.mockReturnValue(chain)
    return selects
  }

  it('never selects *, submitted_by, reviewed_by or review_notes', async () => {
    const selects = recordSelects({ id: 'l1', name: 'Acme', status: 'approved' })

    await getApprovedLabs()
    await getApprovedLabsWithTestCount()
    await getLabDetail('l1')

    expect(selects.length).toBeGreaterThanOrEqual(4)
    for (const cols of selects) {
      expect(cols).not.toMatch(/(^|[\s,(])\*/)
      expect(cols).not.toMatch(/submitted_by|reviewed_by|review_notes/)
    }
  })
})
