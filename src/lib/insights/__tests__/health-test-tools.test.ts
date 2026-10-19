import { describe, it, expect } from 'vitest'

import { createHealthTestTools } from '../health-records/health-test-tools'

type Result = { data: unknown; error: { message: string } | null; count?: number | null }

// Records the calls each query makes and resolves every query to `result`.
function makeDb(result: Result) {
  const calls: Array<[string, unknown[]]> = []
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'delete', 'eq', 'order', 'limit', 'range']) {
    builder[m] = (...args: unknown[]) => {
      calls.push([m, args])
      return builder
    }
  }
  builder.maybeSingle = async () => result
  ;(builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(result)
  return { db: { from: () => builder } as never, calls }
}

const opts = { toolCallId: 't', messages: [], context: {} }

describe('list_health_tests', () => {
  it('returns the page with the total and no truncation when everything fits', async () => {
    const rows = [{ id: 'd1' }, { id: 'd2' }]
    const { db, calls } = makeDb({ data: rows, error: null, count: 2 })
    const tools = createHealthTestTools(db, 'user-1')

    const out = await tools.list_health_tests.execute!({ type: 'dexa' }, opts)

    expect(out).toEqual({ tests: rows, total: 2, truncated: false })
    expect(calls).toContainEqual(['range', [0, 49]])
  })

  it('flags truncation and tells the model how to fetch older rows', async () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ id: `d${i}` }))
    const { db } = makeDb({ data: rows, error: null, count: 73 })
    const tools = createHealthTestTools(db, 'user-1')

    const out = (await tools.list_health_tests.execute!({ type: 'dexa' }, opts)) as {
      total: number
      truncated: boolean
      next_offset?: number
    }

    expect(out.total).toBe(73)
    expect(out.truncated).toBe(true)
    expect(out.next_offset).toBe(50)
  })

  it('pages with offset', async () => {
    const { db, calls } = makeDb({ data: [], error: null, count: 73 })
    const tools = createHealthTestTools(db, 'user-1')

    await tools.list_health_tests.execute!({ type: 'rmr', offset: 50 }, opts)

    expect(calls).toContainEqual(['range', [50, 99]])
  })

  it('returns the query error', async () => {
    const { db } = makeDb({ data: null, error: { message: 'db down' } })
    const tools = createHealthTestTools(db, 'user-1')

    expect(await tools.list_health_tests.execute!({ type: 'dutch' }, opts)).toEqual({
      error: 'db down',
    })
  })
})

describe('delete_health_test', () => {
  it('reports a lookup failure as an error, not as "Test not found."', async () => {
    const { db, calls } = makeDb({ data: null, error: { message: 'db down' } })
    const tools = createHealthTestTools(db, 'user-1')

    const out = await tools.delete_health_test.execute!({ type: 'dexa', id: 'd1' }, opts)

    expect(out).toEqual({ error: 'db down' })
    expect(calls.some(([m]) => m === 'delete')).toBe(false)
  })

  it('reports a missing row as not found', async () => {
    const { db } = makeDb({ data: null, error: null })
    const tools = createHealthTestTools(db, 'user-1')

    expect(await tools.delete_health_test.execute!({ type: 'dexa', id: 'd1' }, opts)).toEqual({
      error: 'Test not found.',
    })
  })
})
