import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: {} }))
vi.mock('@/lib/loinc/resolve', () => ({
  resolveMarker: vi.fn(),
  commitCapture: vi.fn(),
  commitCustomCapture: vi.fn(),
}))

import { createHealthRecordTools } from '../health-record-tools'
import { createStackTools } from '../stack-tools'
import { createProfileTools } from '../profile-tools'
import { createOtherTestTools } from '../other-test-tools'
import { createDocumentIndexTools } from '../document-index-tools'
import { createDocumentReadTools } from '../document-read-tools'
import { createMemoryTool } from '../memory-tool'
import { createLabTestTools } from '@/lib/labs/lab-test-tools'
import { APPROVAL_TOOLS, approvalDetails } from '../tool-approval'

/** A query builder that answers every query with `rows` (per table). */
function makeDb(rowsByTable: Record<string, unknown[]> = {}) {
  return {
    from: (table: string) => {
      const rows = rowsByTable[table] ?? []
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'is', 'gte', 'order', 'limit']) {
        builder[m] = () => builder
      }
      builder.maybeSingle = async () => ({ data: rows[0] ?? null, error: null })
      builder.single = async () => ({ data: rows[0] ?? null, error: null })
      ;(builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: rows, error: null })
      return builder
    },
  } as never
}

type AnyTool = { needsApproval?: boolean | ((input: never, opts: never) => unknown) }

function allTools(db = makeDb()): Record<string, AnyTool> {
  const userId = '11111111-1111-4111-8111-111111111111'
  return {
    ...createLabTestTools(db, userId),
    ...createDocumentIndexTools(db, userId, [], 'thread-1'),
    ...createStackTools(db, userId),
    ...createHealthRecordTools(db, userId, []),
    ...createProfileTools(db, userId),
    ...createOtherTestTools(db, userId),
    ...createDocumentReadTools(db, userId),
    memory: createMemoryTool(userId),
  } as Record<string, AnyTool>
}

const opts = { toolCallId: 't', messages: [], context: {} } as never

describe('approval-gated chat tools', () => {
  it('gates exactly the tools on the approval list', () => {
    const tools = allTools()
    const gated = Object.entries(tools)
      .filter(([, t]) => t.needsApproval !== undefined && t.needsApproval !== false)
      .map(([name]) => name)
      .sort()
    expect(gated).toEqual([...APPROVAL_TOOLS].sort())
  })

  it('gates every delete_/remove_ tool', () => {
    const tools = allTools()
    for (const name of Object.keys(tools).filter((n) => /^(delete|remove)_/.test(n))) {
      expect(tools[name].needsApproval, name).toBe(true)
    }
  })

  it('asks for add_blood_results only when a stored value would be replaced', async () => {
    const catalog = [{ id: 'b-ferritin', name: 'Ferritin', aliases: [], short_name: null, archived_at: null }]
    const replace = allTools(makeDb({ biomarkers: catalog, test_results: [{ id: 'r1' }] })).add_blood_results
    const add = allTools(makeDb({ biomarkers: catalog, test_results: [] })).add_blood_results
    const input = { testId: 'bt-1', markers: [{ name: 'Ferritin', value: 50, unit: 'ng/mL' }] } as never
    const ask = (t: AnyTool) => (t.needsApproval as (i: never, o: never) => Promise<boolean>)(input, opts)
    expect(await ask(replace)).toBe(true)
    expect(await ask(add)).toBe(false)
  })

  it('asks for add_blood_results when a name misses the catalogue and the test has results', async () => {
    const catalog = [{ id: 'b-ferritin', name: 'Ferritin', aliases: [], short_name: null, archived_at: null }]
    const input = { testId: 'bt-1', markers: [{ name: '25-hydroxyvitamin D3 (calcifediol)', value: 30, unit: 'ng/mL' }] } as never
    const withResults = allTools(makeDb({ biomarkers: catalog, test_results: [{ id: 'r1' }] })).add_blood_results
    const empty = allTools(makeDb({ biomarkers: catalog, test_results: [] })).add_blood_results
    const ask = (t: AnyTool) => (t.needsApproval as (i: never, o: never) => Promise<boolean>)(input, opts)
    expect(await ask(withResults)).toBe(true)
    expect(await ask(empty)).toBe(false)
  })

  it("asks for log_body_entry only when that day's entry already exists", async () => {
    const ask = (t: AnyTool) =>
      (t.needsApproval as (i: never, o: never) => Promise<boolean>)({ logged_on: '2026-10-01', weight_kg: 80 } as never, opts)
    expect(await ask(allTools(makeDb({ body_log_entries: [{ id: 'e1' }] })).log_body_entry)).toBe(true)
    expect(await ask(allTools(makeDb({ body_log_entries: [] })).log_body_entry)).toBe(false)
  })

  it('asks for update_other_test only when it replaces the readings', async () => {
    const t = allTools().update_other_test
    const ask = (input: object) => (t.needsApproval as (i: never, o: never) => boolean)(input as never, opts)
    expect(ask({ id: 'o1', notes: 'x' })).toBe(false)
    expect(ask({ id: 'o1', readings: [] })).toBe(true)
  })

  it('asks for memory writes but not reads', () => {
    const t = allTools().memory
    const ask = (input: object) => (t.needsApproval as (i: never, o: never) => boolean)(input as never, opts)
    expect(ask({ command: 'view', path: '/memories' })).toBe(false)
    expect(ask({ command: 'create', path: '/memories/a', file_text: 'x' })).toBe(true)
    expect(ask({ command: 'delete', path: '/memories/a' })).toBe(true)
  })
})

describe('approvalDetails', () => {
  it('hides ids and joins marker names', () => {
    expect(
      approvalDetails({ testId: 'x', markerNames: ['Ferritin', 'TSH'], markers: [{ name: 'Iron', value: 1 }] })
    ).toEqual([
      ['markerNames', 'Ferritin, TSH'],
      ['markers', 'Iron'],
    ])
  })
})
