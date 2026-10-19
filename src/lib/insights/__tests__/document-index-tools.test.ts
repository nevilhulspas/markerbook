import { describe, it, expect, vi } from 'vitest'

// The document-index tools import the health-document registry, whose entries
// transitively import server-only server actions and modules that construct
// real clients at import time. Stub the guard and those modules so loading the
// chain does not require live Supabase env vars.
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: {} }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

// Static import (vi.mock calls are hoisted above it). A per-test dynamic import
// loaded the whole registry chain inside the first test, which could pass the
// default 5s test timeout in a cold, loaded full run (OTH-71 item 21).
import { createDocumentIndexTools } from '../document-index-tools'

function makeDb() {
  return {
    storage: { from: () => ({ download: vi.fn(), createSignedUrl: vi.fn() }) },
    from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'ext-1' } }) }) }) }),
  } as never
}

describe('createDocumentIndexTools', () => {
  it('exposes extract + confirm tools; confirm has no execute (client-resolved)', async () => {
    const tools = createDocumentIndexTools(makeDb(), 'user-1', [], 'thread-1')
    expect(Object.keys(tools).sort()).toEqual(['confirm_health_document_index', 'extract_health_document'])
    expect(typeof tools.extract_health_document.execute).toBe('function')
    expect(tools.confirm_health_document_index.execute).toBeUndefined()
  })

  it('extract rejects when there is no attachment at the index', async () => {
    const tools = createDocumentIndexTools(makeDb(), 'user-1', [], 'thread-1')
    const out = await tools.extract_health_document.execute!(
      { documentType: 'blood' },
      { toolCallId: 't1', messages: [], context: {} }
    )
    expect(out).toMatchObject({ error: expect.stringContaining('attachment') })
  })

  it('extract rejects an unknown document type', async () => {
    const tools = createDocumentIndexTools(makeDb(), 'user-1', [
      { storagePath: 'user-1/chat/x.pdf', mediaType: 'application/pdf', filename: 'x.pdf' },
    ], 'thread-1')
    const out = await tools.extract_health_document.execute!(
      { documentType: 'sibo' as never },
      { toolCallId: 't1', messages: [], context: {} }
    )
    expect(out).toMatchObject({ error: expect.stringContaining('Unknown') })
  })

  it('extract rejects a storagePath outside the user namespace', async () => {
    const tools = createDocumentIndexTools(makeDb(), 'user-1', [
      { storagePath: 'someone-else/chat/x.pdf', mediaType: 'application/pdf', filename: 'x.pdf' },
    ], 'thread-1')
    const out = await tools.extract_health_document.execute!(
      { documentType: 'blood' },
      { toolCallId: 't1', messages: [], context: {} }
    )
    expect(out).toMatchObject({ error: expect.stringContaining('not authorized') })
  })
})
