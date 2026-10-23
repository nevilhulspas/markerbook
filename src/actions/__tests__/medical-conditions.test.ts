// Server-action tests for medical_conditions CRUD.
// Mirrors the in-memory Supabase mock pattern from next-to-test.test.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }))

type Row = Record<string, unknown> & { id: string }
let rows: Row[] = []

function reset() {
  rows = []
  mockGetUser.mockReset()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
}

function createBuilder() {
  const filters: Array<[string, unknown]> = []
  const matched = () =>
    rows.filter((r) => filters.every(([k, v]) => r[k] === v))

  const builder: Record<string, unknown> = {
    select() {
      return builder
    },
    eq(col: string, val: unknown) {
      filters.push([col, val])
      return builder
    },
    order() {
      return builder
    },
    insert(row: Row | Row[]) {
      const list = Array.isArray(row) ? row : [row]
      const inserted = list.map((r) => ({
        ...r,
        id: r.id ?? `id-${Math.random().toString(36).slice(2, 9)}`,
        created_at: new Date('2026-05-29T00:00:00Z').toISOString(),
        updated_at: new Date('2026-05-29T00:00:00Z').toISOString(),
      }))
      rows.push(...inserted)
      const chain: Record<string, unknown> = {
        select: () => chain,
        single: () => Promise.resolve({ data: inserted[0], error: null }),
      }
      return chain
    },
    update(patch: Partial<Row>) {
      const chain: Record<string, unknown> = {
        eq(col: string, val: unknown) {
          filters.push([col, val])
          return chain
        },
        select: () => chain,
        single: () => {
          const ms = matched()
          if (ms[0]) Object.assign(ms[0], patch)
          return Promise.resolve({
            data: ms[0] ?? null,
            error: ms[0]
              ? null
              : { code: 'PGRST116', message: 'no rows updated' },
          })
        },
      }
      return chain
    },
    delete() {
      const chain: Record<string, unknown> = {
        eq(col: string, val: unknown) {
          filters.push([col, val])
          return chain
        },
        // Action calls .select().single() so PGRST116 surfaces on zero-row.
        select: () => chain,
        single: () => {
          const ms = matched()
          if (ms.length === 0) {
            return Promise.resolve({
              data: null,
              error: { code: 'PGRST116', message: 'no rows deleted' },
            })
          }
          ms.forEach((r) => {
            const idx = rows.indexOf(r)
            if (idx >= 0) rows.splice(idx, 1)
          })
          return Promise.resolve({ data: ms[0], error: null })
        },
      }
      return chain
    },
    then(resolve: (v: unknown) => unknown) {
      return resolve({ data: matched(), error: null })
    },
  }
  return builder
}

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: () => createBuilder(),
  }),
}))

import {
  getMedicalConditions,
  addMedicalCondition,
  updateMedicalCondition,
  deleteMedicalCondition,
} from '@/actions/medical-conditions'

describe('medical_conditions actions', () => {
  beforeEach(reset)

  it('addMedicalCondition inserts with the current user_id and trimmed fields', async () => {
    const r = await addMedicalCondition({
      condition_name: '  Hypothyroidism  ',
      start_date: '2020-03-01',
      end_date: '',
      notes: '  Levothyroxine 50mcg  ',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.condition_name).toBe('Hypothyroidism')
      expect(r.data.start_date).toBe('2020-03-01')
      expect(r.data.end_date).toBeNull()
      expect(r.data.notes).toBe('Levothyroxine 50mcg')
    }
    expect(rows).toHaveLength(1)
    expect(rows[0].user_id).toBe('user-1')
  })

  it('addMedicalCondition rejects when end_date is before start_date', async () => {
    const r = await addMedicalCondition({
      condition_name: 'Anything',
      start_date: '2024-05-01',
      end_date: '2024-04-01',
    })
    expect(r.ok).toBe(false)
    if (!r.ok && r.kind === 'invalid') {
      expect(r.details.join(' ')).toMatch(/end date/i)
    }
    expect(rows).toHaveLength(0)
  })

  it('addMedicalCondition rejects when condition_name is empty', async () => {
    const r = await addMedicalCondition({
      condition_name: '   ',
    })
    expect(r.ok).toBe(false)
    expect(rows).toHaveLength(0)
  })

  it('getMedicalConditions returns rows for the current user', async () => {
    rows.push({
      id: 'c-1',
      user_id: 'user-1',
      condition_name: 'Asthma',
      start_date: null,
      end_date: null,
      notes: null,
      created_at: '2026-05-29',
      updated_at: '2026-05-29',
    })
    rows.push({
      id: 'c-2',
      user_id: 'someone-else',
      condition_name: 'Not yours',
    })
    const result = await getMedicalConditions()
    expect(result).toHaveLength(1)
    expect(result[0].condition_name).toBe('Asthma')
  })

  it('returns [] when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    expect(await getMedicalConditions()).toEqual([])
  })

  it('updateMedicalCondition patches an owned row', async () => {
    rows.push({
      id: 'c-1',
      user_id: 'user-1',
      condition_name: 'Old name',
      start_date: '2020-01-01',
      end_date: '2020-06-01',
      notes: null,
    })
    const r = await updateMedicalCondition('c-1', {
      condition_name: 'New name',
      start_date: '2020-01-01',
      end_date: '',
      notes: 'flared again',
    })
    expect(r.ok).toBe(true)
    expect(rows[0].condition_name).toBe('New name')
    expect(rows[0].end_date).toBeNull()
    expect(rows[0].notes).toBe('flared again')
  })

  it('updateMedicalCondition reports DB error on unmatched id', async () => {
    const r = await updateMedicalCondition('nonexistent', {
      condition_name: 'Whatever',
    })
    expect(r.ok).toBe(false)
  })

  it('deleteMedicalCondition removes a matching row', async () => {
    rows.push({
      id: 'c-1',
      user_id: 'user-1',
      condition_name: 'Asthma',
    })
    const r = await deleteMedicalCondition('c-1')
    expect(r.ok).toBe(true)
    expect(rows).toHaveLength(0)
  })

  it('deleteMedicalCondition surfaces PGRST116 as error when row is absent', async () => {
    const r = await deleteMedicalCondition('nonexistent')
    expect(r.ok).toBe(false)
  })

  it('all writes require authentication', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const a = await addMedicalCondition({ condition_name: 'X' })
    const u = await updateMedicalCondition('c-1', { condition_name: 'X' })
    const d = await deleteMedicalCondition('c-1')
    expect(a.ok).toBe(false)
    expect(u.ok).toBe(false)
    expect(d.ok).toBe(false)
    if (!a.ok) expect(a.kind).toBe('unauthorized')
    if (!u.ok) expect(u.kind).toBe('unauthorized')
    if (!d.ok) expect(d.kind).toBe('unauthorized')
  })
})
