import { describe, it, expect } from 'vitest'

import { planBulkMove, type MoveRow } from '../merge'

const TARGET = 'list-dst'

function row(over: Partial<MoveRow> & { id: string }): MoveRow {
  return {
    list_id: 'list-src',
    biomarker_id: null,
    lab_test_id: null,
    status: 'pending',
    note: null,
    due_date: null,
    ...over,
  }
}

describe('planBulkMove', () => {
  it('re-parents rows with no twin on the target list', () => {
    const plan = planBulkMove(
      [row({ id: 'a', biomarker_id: 'bm-1' }), row({ id: 'b', lab_test_id: 'lt-1' })],
      [row({ id: 't', list_id: TARGET, biomarker_id: 'bm-2' })],
      TARGET
    )
    expect(plan.movableIds).toEqual(['a', 'b'])
    expect(plan.mergeSourceIds).toEqual([])
    expect(plan.mergePatches.size).toBe(0)
    expect(plan.alreadyThere).toBe(0)
  })

  it('counts rows already on the target list as no-ops', () => {
    const onTarget = row({ id: 'a', list_id: TARGET, biomarker_id: 'bm-1' })
    const plan = planBulkMove([onTarget], [onTarget], TARGET)
    expect(plan.alreadyThere).toBe(1)
    expect(plan.movableIds).toEqual([])
    expect(plan.mergeSourceIds).toEqual([])
  })

  it('merges a collision by biomarker or lab test into the target twin', () => {
    const plan = planBulkMove(
      [row({ id: 'a', biomarker_id: 'bm-1' }), row({ id: 'b', lab_test_id: 'lt-1' })],
      [
        row({ id: 't1', list_id: TARGET, biomarker_id: 'bm-1' }),
        row({ id: 't2', list_id: TARGET, lab_test_id: 'lt-1' }),
      ],
      TARGET
    )
    expect(plan.movableIds).toEqual([])
    expect(plan.mergeSourceIds).toEqual(['a', 'b'])
    // Nothing to carry over: the twin keeps its own values (empty patches).
    expect(plan.mergePatches).toEqual(
      new Map([
        ['t1', {}],
        ['t2', {}],
      ])
    )
  })

  it('revives a done twin when the source is pending, but never the reverse', () => {
    const revive = planBulkMove(
      [row({ id: 'a', biomarker_id: 'bm-1', status: 'pending' })],
      [row({ id: 't', list_id: TARGET, biomarker_id: 'bm-1', status: 'done' })],
      TARGET
    )
    expect(revive.mergePatches.get('t')).toEqual({ status: 'pending' })

    const keep = planBulkMove(
      [row({ id: 'a', biomarker_id: 'bm-1', status: 'done' })],
      [row({ id: 't', list_id: TARGET, biomarker_id: 'bm-1', status: 'pending' })],
      TARGET
    )
    expect(keep.mergePatches.get('t')).toEqual({})
  })

  it('backfills only empty note/due fields on the twin by default', () => {
    const fill = planBulkMove(
      [row({ id: 'a', biomarker_id: 'bm-1', note: 'src note', due_date: '2026-11-01' })],
      [row({ id: 't', list_id: TARGET, biomarker_id: 'bm-1' })],
      TARGET
    )
    expect(fill.mergePatches.get('t')).toEqual({ note: 'src note', due_date: '2026-11-01' })

    const keep = planBulkMove(
      [row({ id: 'a', biomarker_id: 'bm-1', note: 'src note', due_date: '2026-11-01' })],
      [row({ id: 't', list_id: TARGET, biomarker_id: 'bm-1', note: 'twin', due_date: '2026-12-01' })],
      TARGET
    )
    expect(keep.mergePatches.get('t')).toEqual({})
  })

  it('with sourceWins mirrors differing note/due onto the twin, including a clear to null', () => {
    const plan = planBulkMove(
      [row({ id: 'a', biomarker_id: 'bm-1', note: null, due_date: '2026-11-01' })],
      [row({ id: 't', list_id: TARGET, biomarker_id: 'bm-1', note: 'stale', due_date: '2026-11-01' })],
      TARGET,
      { sourceWins: true }
    )
    // due_date is equal, so only the note (cleared) is patched.
    expect(plan.mergePatches.get('t')).toEqual({ note: null })
  })

  it('when several sources hit one twin, the first one to set a field wins', () => {
    const sources = [
      row({ id: 'a', biomarker_id: 'bm-1', note: 'first' }),
      row({ id: 'b', biomarker_id: 'bm-1', list_id: 'list-other', note: 'second' }),
    ]
    const twin = [row({ id: 't', list_id: TARGET, biomarker_id: 'bm-1' })]

    const backfill = planBulkMove(sources, twin, TARGET)
    expect(backfill.mergeSourceIds).toEqual(['a', 'b'])
    expect(backfill.mergePatches.get('t')).toEqual({ note: 'first' })

    const sourceWins = planBulkMove(sources, twin, TARGET, { sourceWins: true })
    expect(sourceWins.mergePatches.get('t')).toEqual({ note: 'first' })
  })

  it('moves only the first of several selected rows that share a slot with no twin; the rest merge into it', () => {
    // Two lists both hold TSH; the target has none. Moving both rows would put
    // two TSH rows on the target and trip the unique index.
    const plan = planBulkMove(
      [
        row({ id: 'a', biomarker_id: 'bm-1', status: 'done' }),
        row({ id: 'b', biomarker_id: 'bm-1', list_id: 'list-other', note: 'b note' }),
        row({ id: 'c', lab_test_id: 'lt-1' }),
        row({ id: 'd', lab_test_id: 'lt-1', list_id: 'list-other', due_date: '2026-12-01' }),
      ],
      [],
      TARGET
    )
    expect(plan.movableIds).toEqual(['a', 'c'])
    expect(plan.mergeSourceIds).toEqual(['b', 'd'])
    // The moved row is the twin: it absorbs pending + backfills empty fields.
    expect(plan.mergePatches).toEqual(
      new Map([
        ['a', { status: 'pending', note: 'b note' }],
        ['c', { due_date: '2026-12-01' }],
      ])
    )
  })

  it('looks a twin up by biomarker before lab test', () => {
    const plan = planBulkMove(
      [row({ id: 'a', biomarker_id: 'bm-1', lab_test_id: 'lt-1' })],
      [
        row({ id: 't-lab', list_id: TARGET, lab_test_id: 'lt-1' }),
        row({ id: 't-bm', list_id: TARGET, biomarker_id: 'bm-1' }),
      ],
      TARGET
    )
    expect([...plan.mergePatches.keys()]).toEqual(['t-bm'])
  })
})
