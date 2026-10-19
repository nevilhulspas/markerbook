import { describe, it, expect } from 'vitest'

import { createDocumentReadTools } from '../document-read-tools'

const ctx = { toolCallId: 't', messages: [], context: {} }

// Supabase mock: a `.from()` query resolving via maybeSingle, plus a storage
// bucket whose download returns scripted bytes.
function makeDb(row: unknown, bytes: Uint8Array | null = null) {
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'eq']) builder[m] = () => builder
  builder.maybeSingle = () => Promise.resolve({ data: row, error: null })
  return {
    from: () => builder,
    storage: {
      from: () => ({
        download: async () =>
          bytes ? { data: { arrayBuffer: async () => bytes.buffer }, error: null } : { data: null, error: { message: 'not found' } },
      }),
    },
  } as never
}

describe('createDocumentReadTools', () => {
  it('exposes read_test_document', () => {
    const tools = createDocumentReadTools(makeDb(null), 'u1')
    expect(Object.keys(tools)).toEqual(['read_test_document'])
  })

  it('errors when the test has no stored document', async () => {
    const tools = createDocumentReadTools(makeDb({ id: 'x', pdf_storage_path: null }), 'u1')
    const out = await tools.read_test_document.execute!({ type: 'other', id: 'x' }, ctx)
    expect(out).toMatchObject({ error: expect.stringContaining('no uploaded document') })
  })

  it('refuses a path outside the caller namespace', async () => {
    const tools = createDocumentReadTools(makeDb({ id: 'x', pdf_storage_path: 'someone-else/report.pdf' }), 'u1')
    const out = await tools.read_test_document.execute!({ type: 'blood', id: 'x' }, ctx)
    expect(out).toMatchObject({ error: 'Unauthorized document path.' })
  })

  it('refuses an oversized document in toModelOutput with a friendly text error', async () => {
    const huge = new Uint8Array(11 * 1024 * 1024) // 11 MB > 10 MB cap
    const tools = createDocumentReadTools(makeDb({ id: 'x', pdf_storage_path: 'u1/big.pdf' }, huge), 'u1')
    const meta = (await tools.read_test_document.execute!({ type: 'blood', id: 'x' }, ctx)) as never
    const model = await tools.read_test_document.toModelOutput!({ toolCallId: 't', input: { type: 'blood', id: 'x' }, output: meta })
    const parts = (model as { value: Array<{ type: string; text?: string }> }).value
    expect(parts.some((p) => p.type === 'file')).toBe(false)
    expect(parts[0].text).toMatch(/too large/i)
  })

  it('resolves the path (tiny metadata) then hands the document bytes to the model via toModelOutput', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const tools = createDocumentReadTools(makeDb({ id: 'x', pdf_storage_path: 'u1/dental.pdf' }, bytes), 'u1')
    const meta = (await tools.read_test_document.execute!({ type: 'other', id: 'x' }, ctx)) as {
      ok: true; path: string; mediaType: string; filename: string
    }
    // execute stays tiny — no bytes in the persisted output.
    expect(meta).toMatchObject({ ok: true, path: 'u1/dental.pdf', mediaType: 'application/pdf' })
    expect('bytes' in meta).toBe(false)

    const model = await tools.read_test_document.toModelOutput!({ toolCallId: 't', input: { type: 'other', id: 'x' }, output: meta as never })
    expect(model.type).toBe('content')
    const parts = (model as { value: Array<{ type: string; mediaType?: string }> }).value
    const media = parts.find((p) => p.type === 'file')
    expect(media?.mediaType).toBe('application/pdf')
  })
})
