import { describe, it, expect } from 'vitest'

import { createProfileTools } from '../profile-tools'

const ctx = { toolCallId: 't', messages: [], context: {} }

// A minimal Supabase mock that records writes and returns a scripted result per
// terminal call (.maybeSingle / .single / thenable). `script` is consumed in
// call order; the recorder captures the payload of the last insert/update.
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
    builder.in = chain
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

describe('createProfileTools', () => {
  it('exposes the profile + medical-condition tools', () => {
    const { db } = makeDb([])
    const tools = createProfileTools(db, 'u1')
    expect(Object.keys(tools).sort()).toEqual([
      'add_medical_condition',
      'get_profile',
      'remove_medical_condition',
      'update_medical_condition',
      'update_profile',
    ])
  })

  it('update_profile patches only the passed fields', async () => {
    const { db, calls } = makeDb([{ data: null, error: null }])
    const tools = createProfileTools(db, 'u1')
    const out = await tools.update_profile.execute!(
      { weight_kg: 82, smoking_status: 'former' },
      ctx
    )
    expect(out).toMatchObject({ updated: expect.arrayContaining(['weight_kg', 'smoking_status']) })
    const upd = calls.find((c) => c.op === 'update')!
    const payload = upd.payload as Record<string, unknown>
    expect(payload.weight_kg).toBe(82)
    expect(payload.smoking_status).toBe('former')
    // Fields the caller didn't pass must not appear in the patch.
    expect('height_cm' in payload).toBe(false)
    expect(payload.updated_at).toEqual(expect.any(String))
  })

  it('update_profile clears a free-text field to null on empty string', async () => {
    const { db, calls } = makeDb([{ data: null, error: null }])
    const tools = createProfileTools(db, 'u1')
    await tools.update_profile.execute!({ known_allergies: '', weight_kg: 80 }, ctx)
    const payload = calls.find((c) => c.op === 'update')!.payload as Record<string, unknown>
    expect(payload.known_allergies).toBeNull() // cleared, not ""
    expect(payload.weight_kg).toBe(80) // non-free-text passes through
  })

  it('update_profile with no fields is a no-op error', async () => {
    const { db, calls } = makeDb([])
    const tools = createProfileTools(db, 'u1')
    const out = await tools.update_profile.execute!({}, ctx)
    expect(out).toMatchObject({ error: expect.any(String) })
    expect(calls.some((c) => c.op === 'update')).toBe(false)
  })

  it('remove_medical_condition reports not-found when the id is missing', async () => {
    const { db, calls } = makeDb([{ data: null, error: null }]) // existence check → null
    const tools = createProfileTools(db, 'u1')
    const out = await tools.remove_medical_condition.execute!({ id: 'nope' }, ctx)
    expect(out).toMatchObject({ error: 'Condition not found.' })
    expect(calls.some((c) => c.op === 'delete')).toBe(false)
  })

  it('add_medical_condition inserts with the caller user_id and trims the name', async () => {
    const { db, calls } = makeDb([{ data: { id: 'c1', condition_name: 'Sleep apnea' }, error: null }])
    const tools = createProfileTools(db, 'u1')
    const out = await tools.add_medical_condition.execute!(
      { condition_name: '  Sleep apnea  ' },
      ctx
    )
    expect(out).toMatchObject({ added: { id: 'c1' } })
    const ins = calls.find((c) => c.op === 'insert')!.payload as Record<string, unknown>
    expect(ins.user_id).toBe('u1')
    expect(ins.condition_name).toBe('Sleep apnea')
  })
})
