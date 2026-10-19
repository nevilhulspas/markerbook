import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

function makeDb(rows: unknown[] = []) {
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'ilike', 'is', 'maybeSingle', 'single', 'order', 'limit', 'in']) {
    builder[m] = () => builder
  }
  ;(builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: rows, error: null })
  return { from: () => builder } as never
}

describe('createStackTools', () => {
  it('exposes the stack + wishlist tools', async () => {
    const { createStackTools } = await import('../stack-tools')
    const tools = createStackTools(makeDb(), 'user-1')
    expect(Object.keys(tools).sort()).toEqual([
      'add_supplement',
      'add_to_wishlist',
      'add_wishlist_source',
      'list_stack',
      'list_wishlist',
      'move_wishlist_to_stack',
      'remove_from_wishlist',
      'remove_supplement',
      'update_supplement',
      'update_wishlist_item',
    ])
  })

  it('add_supplement rejects an empty name', async () => {
    const { createStackTools } = await import('../stack-tools')
    const tools = createStackTools(makeDb(), 'user-1')
    const out = await tools.add_supplement.execute!({ name: '' }, { toolCallId: 't', messages: [], context: {} })
    expect(out).toMatchObject({ error: expect.any(String) })
  })

  it('list_stack returns every entry tagged with a status (active, upcoming AND stopped)', async () => {
    const { createStackTools } = await import('../stack-tools')
    // Far-past/-future dates keep the active vs upcoming split deterministic
    // regardless of the real current date; an end_date marks stopped.
    const rows = [
      { id: 'a', name: 'Vitamin D', start_date: '2000-01-01', end_date: null },
      { id: 'u', name: 'Creatine', start_date: '2999-01-01', end_date: null },
      { id: 's', name: 'Old Iron', start_date: '2000-01-01', end_date: '2001-01-01' },
    ]
    const tools = createStackTools(makeDb(rows), 'user-1')
    const out = (await tools.list_stack.execute!({}, { toolCallId: 't', messages: [], context: {} })) as {
      supplements: Array<{ id: string; status: string }>
    }
    // Order-insensitive: two rows share a start_date, so tie-break order isn't
    // guaranteed by a real DB — assert presence of all three status pairs.
    const pairs = out.supplements.map((s) => [s.id, s.status])
    expect(pairs).toEqual(
      expect.arrayContaining([
        ['a', 'active'],
        ['u', 'upcoming'],
        ['s', 'stopped'],
      ])
    )
    expect(pairs).toHaveLength(3)
  })
})
