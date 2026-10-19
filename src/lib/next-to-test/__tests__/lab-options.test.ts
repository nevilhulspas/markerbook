import { describe, it, expect } from 'vitest'

import {
  collectLabOptionCandidates,
  countMarkersPerLabTest,
  rankLabOptions,
  toLabTestsForBiomarker,
  type LabOptionCandidate,
  type LabOptionRow,
  type LabTestForBiomarkerRow,
} from '../lab-options'

const alpha = { id: 'lab-a', name: 'Alpha', status: 'approved' }
const beta = { id: 'lab-b', name: 'Beta', status: 'approved' }

function optionRow(
  biomarkerId: string,
  lt: { id: string; name?: string; cost?: number | string | null; status?: string },
  lab: { id: string; name: string; status: string } | null = alpha
): LabOptionRow {
  return {
    biomarker_id: biomarkerId,
    lab_tests: {
      id: lt.id,
      name: lt.name ?? 'Test',
      cost: lt.cost ?? null,
      status: lt.status ?? 'approved',
      labs: lab,
    },
  }
}

function candidate(over: Partial<LabOptionCandidate> & { labTestId: string }): LabOptionCandidate {
  return {
    biomarkerId: 'bm-1',
    labId: 'lab-a',
    labName: 'Alpha',
    labTestName: 'Test',
    cost: 10,
    ...over,
  }
}

describe('collectLabOptionCandidates', () => {
  it('keeps approved tests of approved labs and unwraps array-shaped joins', () => {
    const { candidates, labTestIds } = collectLabOptionCandidates([
      optionRow('bm-1', { id: 'lt-1', cost: 12 }),
      {
        biomarker_id: 'bm-1',
        lab_tests: [{ id: 'lt-2', name: 'Arr', cost: 8, status: 'approved', labs: [beta] }],
      },
      optionRow('bm-1', { id: 'lt-3', status: 'pending' }),
      optionRow('bm-1', { id: 'lt-4' }, { id: 'lab-x', name: 'X', status: 'rejected' }),
      optionRow('bm-1', { id: 'lt-5' }, null),
      { biomarker_id: 'bm-1', lab_tests: null },
    ])
    expect(candidates.map((c) => c.labTestId)).toEqual(['lt-1', 'lt-2'])
    expect(candidates[1]).toEqual({
      biomarkerId: 'bm-1',
      labId: 'lab-b',
      labName: 'Beta',
      labTestId: 'lt-2',
      labTestName: 'Arr',
      cost: 8,
    })
    expect([...labTestIds]).toEqual(['lt-1', 'lt-2'])
  })

  it('parses string costs and maps missing or invalid costs to Infinity', () => {
    const { candidates } = collectLabOptionCandidates([
      optionRow('bm-1', { id: 'lt-1', cost: '19.5' }),
      optionRow('bm-1', { id: 'lt-2', cost: null }),
      optionRow('bm-1', { id: 'lt-3', cost: 'n/a' }),
    ])
    expect(candidates.map((c) => c.cost)).toEqual([19.5, Infinity, Infinity])
  })
})

describe('countMarkersPerLabTest', () => {
  it('counts mapping rows per lab test', () => {
    const counts = countMarkersPerLabTest([
      { lab_test_id: 'lt-1' },
      { lab_test_id: 'lt-2' },
      { lab_test_id: 'lt-1' },
    ])
    expect(counts).toEqual(
      new Map([
        ['lt-1', 2],
        ['lt-2', 1],
      ])
    )
  })
})

describe('rankLabOptions', () => {
  it('sorts labs alphabetically, then preferred, marker count, cost, name length, id', () => {
    const out = rankLabOptions(
      [
        candidate({ labTestId: 'lt-beta', labId: 'lab-b', labName: 'Beta', cost: 1 }),
        candidate({ labTestId: 'lt-panel', cost: 1 }),
        candidate({ labTestId: 'lt-long', labTestName: 'Longer name', cost: 5 }),
        candidate({ labTestId: 'lt-b', labTestName: 'Short', cost: 5 }),
        candidate({ labTestId: 'lt-a', labTestName: 'Short', cost: 5 }),
        candidate({ labTestId: 'lt-cheap', labTestName: 'Longest name of all', cost: 2 }),
        candidate({ labTestId: 'lt-pinned', cost: 99 }),
      ],
      new Map([
        ['lt-panel', 4],
        ['lt-pinned', 4],
        ['lt-long', 1],
        ['lt-a', 1],
        ['lt-b', 1],
        ['lt-cheap', 1],
        ['lt-beta', 1],
      ]),
      ['lt-pinned']
    )
    expect(out['bm-1'].map((o) => o.labTestId)).toEqual([
      'lt-pinned',
      'lt-cheap',
      'lt-a',
      'lt-b',
      'lt-long',
      'lt-panel',
      'lt-beta',
    ])
  })

  it('groups per biomarker and maps Infinity cost to null', () => {
    const out = rankLabOptions(
      [
        candidate({ labTestId: 'lt-1', biomarkerId: 'bm-1', cost: Infinity }),
        candidate({ labTestId: 'lt-1', biomarkerId: 'bm-2', cost: Infinity }),
      ],
      new Map([['lt-1', 2]]),
      []
    )
    expect(Object.keys(out)).toEqual(['bm-1', 'bm-2'])
    expect(out['bm-2']).toEqual([
      {
        labId: 'lab-a',
        labName: 'Alpha',
        labTestId: 'lt-1',
        labTestName: 'Test',
        markerCount: 2,
        cost: null,
      },
    ])
  })

  it('ranks a lab test with no count last: only a failed count read leaves one out', () => {
    // Its true count is unknown (often a big panel), so it must not pass as a
    // dedicated single-marker test. The display falls back to 1.
    const out = rankLabOptions(
      [candidate({ labTestId: 'lt-uncounted', cost: 1 }), candidate({ labTestId: 'lt-panel', cost: 1 })],
      new Map([['lt-panel', 3]]),
      []
    )
    expect(out['bm-1'].map((o) => [o.labTestId, o.markerCount])).toEqual([
      ['lt-panel', 3],
      ['lt-uncounted', 1],
    ])
  })

  it('returns {} for no candidates', () => {
    expect(rankLabOptions([], new Map(), [])).toEqual({})
  })
})

describe('toLabTestsForBiomarker', () => {
  function labTestRow(
    id: string,
    name: string,
    lab: { id: string; name: string; status: string } | null,
    status = 'approved'
  ): LabTestForBiomarkerRow {
    return {
      lab_test_id: id,
      lab_tests: { id, name, cost: 10, currency: 'EUR', status, labs: lab },
    }
  }

  it('keeps approved tests of approved labs, sorted by lab then test name', () => {
    const out = toLabTestsForBiomarker([
      labTestRow('lt-b', 'Ferritin', beta),
      labTestRow('lt-a2', 'Iron panel', alpha),
      labTestRow('lt-a1', 'Ferritin', alpha),
      labTestRow('lt-draft', 'Draft', alpha, 'pending'),
      labTestRow('lt-x', 'Ferritin', { id: 'lab-x', name: 'X', status: 'pending' }),
      labTestRow('lt-none', 'Ferritin', null),
    ])
    expect(out).toEqual([
      { labTestId: 'lt-a1', testName: 'Ferritin', labName: 'Alpha', cost: 10, currency: 'EUR' },
      { labTestId: 'lt-a2', testName: 'Iron panel', labName: 'Alpha', cost: 10, currency: 'EUR' },
      { labTestId: 'lt-b', testName: 'Ferritin', labName: 'Beta', cost: 10, currency: 'EUR' },
    ])
  })

  it('parses string costs and maps invalid ones to null, like the source picker', () => {
    const row = (id: string, cost: number | string | null): LabTestForBiomarkerRow => ({
      lab_test_id: id,
      lab_tests: { id, name: id, cost, currency: 'EUR', status: 'approved', labs: alpha },
    })
    const out = toLabTestsForBiomarker([row('a', '19.50'), row('b', 'n/a'), row('c', null), row('d', 7)])
    expect(out.map((o) => o.cost)).toEqual([19.5, null, null, 7])
  })

  it('unwraps array-shaped joins', () => {
    const out = toLabTestsForBiomarker([
      {
        lab_test_id: 'lt-1',
        lab_tests: [{ id: 'lt-1', name: 'TSH', cost: null, currency: null, status: 'approved', labs: [beta] }],
      },
    ])
    expect(out).toEqual([{ labTestId: 'lt-1', testName: 'TSH', labName: 'Beta', cost: null, currency: null }])
  })
})
