import { describe, it, expect } from 'vitest'

import { createOtherTestTools } from '../other-test-tools'

const ctx = { toolCallId: 't', messages: [], context: {} }

function makeDb(script: Array<{ data: unknown; error: unknown }>) {
  const calls: Array<{ op: string; table: string; payload?: unknown }> = []
  let i = 0
  const next = () => script[i++] ?? { data: null, error: null }
  function from(table: string) {
    let op = 'select'
    let payload: unknown
    const builder: Record<string, unknown> = {}
    const chain = () => builder
    builder.select = chain
    builder.eq = chain
    builder.order = chain
    builder.limit = chain
    builder.insert = (p: unknown) => { op = 'insert'; payload = p; calls.push({ op, table, payload }); return builder }
    builder.update = (p: unknown) => { op = 'update'; payload = p; calls.push({ op, table, payload }); return builder }
    builder.delete = () => { op = 'delete'; calls.push({ op, table }); return builder }
    builder.maybeSingle = () => Promise.resolve(next())
    builder.single = () => Promise.resolve(next())
    ;(builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(next())
    return builder
  }
  return { db: { from } as never, calls }
}

describe('createOtherTestTools', () => {
  it('exposes the other-test CRUD tools', () => {
    const { db } = makeDb([])
    const tools = createOtherTestTools(db, 'u1')
    expect(Object.keys(tools).sort()).toEqual([
      'create_other_test',
      'delete_other_test',
      'get_other_test',
      'list_other_tests',
      'update_other_test',
    ])
  })

  it('create_other_test inserts the test (source=manual) and its readings', async () => {
    const { db, calls } = makeDb([
      { data: { id: 'ot1' }, error: null }, // insert other_tests → id
      { data: null, error: null }, // insert readings
    ])
    const tools = createOtherTestTools(db, 'u1')
    const out = await tools.create_other_test.execute!(
      {
        test_name: 'SIBO breath test',
        test_date: '2026-06-09',
        outcome: 'negative',
        readings: [{ label: 'Hydrogen peak', value: '8', unit: 'ppm' }],
      },
      ctx
    )
    expect(out).toMatchObject({ created: 'ot1' })
    const testInsert = calls.find((c) => c.table === 'other_tests' && c.op === 'insert')!
      .payload as Record<string, unknown>
    expect(testInsert.user_id).toBe('u1')
    expect(testInsert.source).toBe('manual')
    expect(testInsert.outcome).toBe('negative')
    const readingsInsert = calls.find((c) => c.table === 'other_test_values')!
      .payload as Array<Record<string, unknown>>
    expect(readingsInsert[0]).toMatchObject({ test_id: 'ot1', label: 'Hydrogen peak', sort_order: 0 })
  })

  it('update_other_test leaves readings untouched when `readings` is omitted', async () => {
    const { db, calls } = makeDb([
      { data: { id: 'ot1' }, error: null }, // existence check
      { data: null, error: null }, // metadata update
    ])
    const tools = createOtherTestTools(db, 'u1')
    const out = await tools.update_other_test.execute!(
      { id: 'ot1', result_summary: 'Absence of SIBO' },
      ctx
    )
    expect(out).toMatchObject({ updated: 'ot1', changed: ['result_summary'] })
    // No touching of other_test_values at all.
    expect(calls.some((c) => c.table === 'other_test_values')).toBe(false)
  })

  it('update_other_test REPLACES readings when `readings` is provided', async () => {
    const { db, calls } = makeDb([
      { data: { id: 'ot1' }, error: null }, // existence check
      { data: [], error: null }, // snapshot of existing readings
      { data: null, error: null }, // delete
      { data: null, error: null }, // insert new readings
    ])
    const tools = createOtherTestTools(db, 'u1')
    const out = await tools.update_other_test.execute!(
      { id: 'ot1', readings: [{ label: 'Methane peak', value: '3' }] },
      ctx
    )
    expect(out).toMatchObject({ changed: expect.arrayContaining(['readings']) })
    expect(calls.some((c) => c.table === 'other_test_values' && c.op === 'delete')).toBe(true)
    expect(calls.some((c) => c.table === 'other_test_values' && c.op === 'insert')).toBe(true)
  })

  it('delete_other_test refuses when the test does not exist', async () => {
    const { db, calls } = makeDb([{ data: null, error: null }])
    const tools = createOtherTestTools(db, 'u1')
    const out = await tools.delete_other_test.execute!({ id: 'nope' }, ctx)
    expect(out).toMatchObject({ error: 'Test not found.' })
    expect(calls.some((c) => c.op === 'delete')).toBe(false)
  })
})
