import { describe, it, expect, vi, beforeEach } from 'vitest'

// Pins the lab-option lookups behind the next-to-test source picker and the
// "Add to next-to-test" dialog: which catalogue rows survive the approval
// filters and the order they come back in.

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }))

type Lab = { id: string; name: string; status: string }
type LabTest = {
  id: string
  name: string
  cost: number | string | null
  currency: string | null
  status: string
  labId: string
  // Return the nested relations as one-element arrays, the shape PostgREST's
  // inferred types promise for joins.
  asArray?: boolean
}

let labs: Lab[] = []
let labTests: LabTest[] = []
let mappings: Array<{ biomarker_id: string; lab_test_id: string }> = []
let queries: string[] = []
// .range() calls per query, and a query (matched by its select columns) that fails.
let ranges: Array<[string, number, number]> = []
let failingColumns: string | null = null

function nested(lt: LabTest) {
  const lab = labs.find((l) => l.id === lt.labId) ?? null
  const labTest = {
    id: lt.id,
    name: lt.name,
    cost: lt.cost,
    currency: lt.currency,
    status: lt.status,
    labs: lt.asArray && lab ? [lab] : lab,
  }
  return lt.asArray ? [labTest] : labTest
}

function labTestById(id: string): LabTest {
  const lt = labTests.find((t) => t.id === id)
  if (!lt) throw new Error(`fixture is missing lab test ${id}`)
  return lt
}

function createBuilder(table: string) {
  let cols = ''
  const rowsFor = (col: string, vals: unknown[]) => {
    const ms = mappings.filter((m) => vals.includes(m[col as keyof typeof m]))
    if (cols === 'lab_test_id') return ms.map((m) => ({ lab_test_id: m.lab_test_id }))
    if (cols.startsWith('lab_test_id,')) {
      return ms.map((m) => ({
        lab_test_id: m.lab_test_id,
        lab_tests: nested(labTestById(m.lab_test_id)),
      }))
    }
    return ms.map((m) => ({
      biomarker_id: m.biomarker_id,
      lab_tests: nested(labTestById(m.lab_test_id)),
    }))
  }
  // `.in()` / `.eq()` start a query that can be awaited directly or refined
  // with `.order()` + `.range()`, like a PostgREST builder.
  const query = (rows: unknown[]) => {
    let page = rows
    const q = {
      order: () => q,
      range(from: number, to: number) {
        ranges.push([cols, from, to])
        page = rows.slice(from, to + 1)
        return q
      },
      then(resolve: (v: unknown) => unknown) {
        if (failingColumns && cols === failingColumns) {
          return Promise.resolve({ data: null, error: { message: 'db down' } }).then(resolve)
        }
        return Promise.resolve({ data: page, error: null }).then(resolve)
      },
    }
    return q
  }
  const builder = {
    select(c: string) {
      cols = c
      return builder
    },
    in(col: string, vals: unknown[]) {
      queries.push(`${table}:${cols}:in:${col}`)
      return query(rowsFor(col, vals))
    },
    eq(col: string, val: unknown) {
      queries.push(`${table}:${cols}:eq:${col}`)
      return query(rowsFor(col, [val]))
    },
  }
  return builder
}

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (t: string) => createBuilder(t),
  }),
}))

import {
  getLabOptionsForBiomarkers,
  getLabTestsForBiomarker,
} from '@/actions/next-to-test/lookup'

function seed() {
  labs = [
    { id: 'lab-alpha', name: 'Alpha', status: 'approved' },
    { id: 'lab-beta', name: 'Beta', status: 'approved' },
    { id: 'lab-gamma', name: 'Gamma', status: 'pending' },
  ]
  labTests = [
    { id: 'lt-a1', name: 'TSH', cost: 20, currency: 'EUR', status: 'approved', labId: 'lab-alpha' },
    { id: 'lt-a0', name: 'TSH', cost: 20, currency: 'EUR', status: 'approved', labId: 'lab-alpha' },
    { id: 'lt-a3', name: 'TSH test', cost: '15', currency: 'EUR', status: 'approved', labId: 'lab-alpha' },
    { id: 'lt-a4', name: 'TSH', cost: null, currency: null, status: 'approved', labId: 'lab-alpha' },
    { id: 'lt-a5', name: 'TSH serum', cost: 20, currency: 'EUR', status: 'approved', labId: 'lab-alpha' },
    { id: 'lt-a2', name: 'Thyroid panel', cost: 50, currency: 'EUR', status: 'approved', labId: 'lab-alpha' },
    { id: 'lt-ax', name: 'TSH draft', cost: 1, currency: 'EUR', status: 'pending', labId: 'lab-alpha' },
    { id: 'lt-b1', name: 'TSH', cost: 25, currency: 'EUR', status: 'approved', labId: 'lab-beta', asArray: true },
    { id: 'lt-g1', name: 'TSH', cost: 5, currency: 'EUR', status: 'approved', labId: 'lab-gamma' },
  ]
  mappings = [
    { biomarker_id: 'bm-tsh', lab_test_id: 'lt-b1' },
    { biomarker_id: 'bm-tsh', lab_test_id: 'lt-a2' },
    { biomarker_id: 'bm-tsh', lab_test_id: 'lt-a4' },
    { biomarker_id: 'bm-tsh', lab_test_id: 'lt-a5' },
    { biomarker_id: 'bm-tsh', lab_test_id: 'lt-a1' },
    { biomarker_id: 'bm-tsh', lab_test_id: 'lt-a3' },
    { biomarker_id: 'bm-tsh', lab_test_id: 'lt-a0' },
    { biomarker_id: 'bm-tsh', lab_test_id: 'lt-ax' },
    { biomarker_id: 'bm-tsh', lab_test_id: 'lt-g1' },
    { biomarker_id: 'bm-ft4', lab_test_id: 'lt-a2' },
    { biomarker_id: 'bm-ft3', lab_test_id: 'lt-a2' },
  ]
}

beforeEach(() => {
  seed()
  queries = []
  ranges = []
  failingColumns = null
  mockGetUser.mockReset()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
})

describe('getLabOptionsForBiomarkers', () => {
  it('returns {} without querying for an empty or blank id list', async () => {
    await expect(getLabOptionsForBiomarkers([])).resolves.toEqual({})
    await expect(getLabOptionsForBiomarkers(['', ''])).resolves.toEqual({})
    expect(queries).toEqual([])
  })

  it('orders labs alphabetically, then dedicated tests by marker count, cost, name length and id', async () => {
    const out = await getLabOptionsForBiomarkers(['bm-tsh'])
    expect(out['bm-tsh'].map((o) => o.labTestId)).toEqual([
      'lt-a3', // 1 marker, cost 15 (string from PostgREST numeric)
      'lt-a0', // 1 marker, cost 20, short name, id before lt-a1
      'lt-a1',
      'lt-a5', // 1 marker, cost 20, longer name
      'lt-a4', // 1 marker, no price sorts last
      'lt-a2', // panel of 3
      'lt-b1', // Beta after Alpha
    ])
  })

  it('drops unapproved lab tests and lab tests of unapproved labs', async () => {
    const out = await getLabOptionsForBiomarkers(['bm-tsh'])
    const ids = out['bm-tsh'].map((o) => o.labTestId)
    expect(ids).not.toContain('lt-ax')
    expect(ids).not.toContain('lt-g1')
  })

  it('maps each option with its marker count and a null cost for missing prices', async () => {
    const out = await getLabOptionsForBiomarkers(['bm-tsh'])
    const byId = new Map(out['bm-tsh'].map((o) => [o.labTestId, o]))
    expect(byId.get('lt-a3')).toEqual({
      labId: 'lab-alpha',
      labName: 'Alpha',
      labTestId: 'lt-a3',
      labTestName: 'TSH test',
      markerCount: 1,
      cost: 15,
    })
    expect(byId.get('lt-a2')?.markerCount).toBe(3)
    expect(byId.get('lt-a4')?.cost).toBeNull()
    // Array-shaped nested relations are unwrapped.
    expect(byId.get('lt-b1')).toMatchObject({ labId: 'lab-beta', labName: 'Beta', cost: 25 })
  })

  it('puts a preferred (currently pinned) lab test first within its lab only', async () => {
    const out = await getLabOptionsForBiomarkers(['bm-tsh'], ['lt-a2'])
    expect(out['bm-tsh'].map((o) => o.labTestId)).toEqual([
      'lt-a2',
      'lt-a3',
      'lt-a0',
      'lt-a1',
      'lt-a5',
      'lt-a4',
      'lt-b1',
    ])
  })

  it('keys results per biomarker and omits biomarkers no approved lab offers', async () => {
    const out = await getLabOptionsForBiomarkers(['bm-ft4', 'bm-tsh', 'bm-ft4', 'bm-none'])
    expect(Object.keys(out).sort()).toEqual(['bm-ft4', 'bm-tsh'])
    expect(out['bm-ft4'].map((o) => o.labTestId)).toEqual(['lt-a2'])
    expect('bm-none' in out).toBe(false)
  })

  it('reads every marker-count row, past the 1000-row page cap', async () => {
    // A 1500-marker panel: one page would cut its count short.
    for (let i = 0; i < 1500; i++) {
      mappings.push({ biomarker_id: `bm-x${i}`, lab_test_id: 'lt-a2' })
    }
    const out = await getLabOptionsForBiomarkers(['bm-tsh'])
    expect(out['bm-tsh'].find((o) => o.labTestId === 'lt-a2')?.markerCount).toBe(1503)
    expect(ranges.filter(([c]) => c === 'lab_test_id').map(([, f]) => f).slice(0, 2)).toEqual([
      0, 1000,
    ])
  })

  it('logs a failed marker-count read and still lists the options', async () => {
    failingColumns = 'lab_test_id'
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = await getLabOptionsForBiomarkers(['bm-tsh'])
    expect(out['bm-tsh']).toHaveLength(7)
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('marker counts'), 'db down')
    logged.mockRestore()
  })

  it('logs a failed main read instead of failing silently', async () => {
    failingColumns =
      'biomarker_id, lab_tests!inner(id, name, cost, status, labs!inner(id, name, status))'
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await getLabOptionsForBiomarkers(['bm-tsh'])).toEqual({})
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('getLabOptionsForBiomarkers'), 'db down')
    logged.mockRestore()
  })

  it('skips the marker-count query when nothing survives the filters', async () => {
    const out = await getLabOptionsForBiomarkers(['bm-none'])
    expect(out).toEqual({})
    expect(queries).toEqual([
      'lab_test_biomarkers:biomarker_id, lab_tests!inner(id, name, cost, status, labs!inner(id, name, status)):in:biomarker_id',
    ])
  })
})

describe('getLabTestsForBiomarker', () => {
  it('returns [] for signed-out callers without querying', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    await expect(getLabTestsForBiomarker('bm-tsh')).resolves.toEqual([])
    expect(queries).toEqual([])
  })

  it('lists approved lab tests of approved labs, sorted by lab then test name', async () => {
    const out = await getLabTestsForBiomarker('bm-tsh')
    expect(out.map((o) => `${o.labName}/${o.testName}/${o.labTestId}`)).toEqual([
      'Alpha/Thyroid panel/lt-a2',
      'Alpha/TSH/lt-a4',
      'Alpha/TSH/lt-a1',
      'Alpha/TSH/lt-a0',
      'Alpha/TSH serum/lt-a5',
      'Alpha/TSH test/lt-a3',
      'Beta/TSH/lt-b1',
    ])
  })

  it('parses a string cost to a number and passes currency through', async () => {
    const out = await getLabTestsForBiomarker('bm-tsh')
    const byId = new Map(out.map((o) => [o.labTestId, o]))
    expect(byId.get('lt-a3')).toEqual({
      labTestId: 'lt-a3',
      testName: 'TSH test',
      labName: 'Alpha',
      cost: 15,
      currency: 'EUR',
    })
    expect(byId.get('lt-a4')).toMatchObject({ cost: null, currency: null })
  })
})
