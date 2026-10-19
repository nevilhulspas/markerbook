import { describe, it, expect } from 'vitest'

import { fetchBiomarkerRows, fetchLabTestRows } from '../lab-test-tools/add-item'

// A table that honours .range(from, to) and a server row cap (`maxRows`), like
// PostgREST, so paging is real.
function pagedDb(total: number, failAtFrom?: number, maxRows = 1000) {
  const ranges: Array<[number, number]> = []
  const from = () => {
    let range: [number, number] = [0, total - 1]
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order']) builder[m] = () => builder
    builder.range = (a: number, b: number) => {
      range = [a, b]
      ranges.push(range)
      return builder
    }
    builder.then = (resolve: (v: unknown) => unknown) => {
      if (failAtFrom !== undefined && range[0] === failAtFrom) {
        return resolve({ data: null, error: { message: 'db down' } })
      }
      const rows = []
      const last = Math.min(range[1], total - 1, range[0] + maxRows - 1)
      for (let i = range[0]; i <= last; i++) {
        rows.push({ id: `r${i}`, name: `Row ${i}`, short_name: null, sample_type: null, labs: { name: 'L' } })
      }
      return resolve({ data: rows, error: null })
    }
    return builder
  }
  return { db: { from } as never, ranges }
}

describe('catalogue fetches', () => {
  it('pages past the 1000-row PostgREST cap until the last short page', async () => {
    const { db, ranges } = pagedDb(2345)

    const res = await fetchBiomarkerRows(db)

    expect('rows' in res && res.rows).toHaveLength(2345)
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
      [2345, 3344], // the empty page that ends the read
    ])
  })

  it('reads every row when the server caps a page below the page size', async () => {
    const { db } = pagedDb(1234, undefined, 500)

    const res = await fetchBiomarkerRows(db)

    expect('rows' in res && res.rows.map((r) => r.id)).toEqual(
      Array.from({ length: 1234 }, (_, i) => `r${i}`)
    )
  })

  it('stops at the first empty page when the catalogue is small', async () => {
    const { db, ranges } = pagedDb(12)

    const res = await fetchLabTestRows(db)

    expect('rows' in res && res.rows).toHaveLength(12)
    expect(ranges).toEqual([
      [0, 999],
      [12, 1011],
    ])
  })

  it('returns the read error instead of a partial or empty catalogue', async () => {
    const { db } = pagedDb(2345, 1000)

    expect(await fetchBiomarkerRows(db)).toEqual({ error: 'db down' })
  })
})
