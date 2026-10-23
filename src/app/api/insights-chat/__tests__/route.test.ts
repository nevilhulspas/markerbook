import { describe, it, expect, vi, beforeEach } from 'vitest'
// AI routes and actions refuse to run without a key (isAiConfigured).
vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
// The per-user AI limit has its own tests (src/lib/ai/__tests__/quota.test.ts).
vi.mock('@/lib/ai/quota', () => ({
  takeAiRequest: async () => ({ ok: true }),
  countedAiCall: (_userId: string, fn: unknown) => fn,
  aiLimitResponse: (error: string) => Response.json({ error }, { status: 429 }),
  AI_LIMIT_REACHED: 'limit',
}))

// --- hoisted mocks shared across the test file -----------------------------
const {
  mockGetUser,
  mockStreamText,
  mockWebSearchFactory,
  mockBuildPrompt,
  mockCreateLabTestTools,
  mockConsumeStream,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockStreamText: vi.fn(),
  mockWebSearchFactory: vi.fn(),
  mockBuildPrompt: vi.fn(),
  mockCreateLabTestTools: vi.fn(),
  mockConsumeStream: vi.fn(),
}))

// supabaseAdmin mock state ---------------------------------------------------
let threadRow: unknown = { id: 'thread-1', user_id: '11111111-1111-4111-8111-111111111111' }
let messageCount = 1
let inserts: Array<{ table: string; data: unknown }> = []
let updates: Array<{ table: string; data: unknown }> = []
/** Errors the next chat_messages inserts return, in order (then success). */
let insertErrors: Array<{ message: string } | null> = []
/** Options of every upsert call (the reply retry). */
let upsertOptions: unknown[] = []

// createUIMessageStream state ------------------------------------------------
type OnFinishArg = {
  responseMessage: { parts: unknown[] }
  isAborted?: boolean
}
type UiStreamConfig = {
  originalMessages?: unknown[]
  execute: (opts: { writer: unknown }) => Promise<void> | void
  onEnd?: (arg: OnFinishArg) => Promise<void> | void
}
let streamConfig: UiStreamConfig | null = null
/** Every chunk the route wrote to the response stream, in order. */
let writes: unknown[] = []
/** Resolves when the route's turn loop has finished. */
let executed: Promise<void> = Promise.resolve()
/** Configs passed to `toUIMessageStream()`, one per turn attempt. */
let uiStreamConfigs: Array<Record<string, unknown>> = []
/** Options the route handed to `createUIMessageStreamResponse`. */
let responseInit: Record<string, unknown> | null = null

/**
 * A `streamText` result stub. Defaults describe a turn that finished properly;
 * override to describe one that was cut short.
 */
function fakeRun(
  overrides: {
    text?: string
    toolCallCount?: number
    /**
     * Tool calls left WITHOUT a result — what a client-answered tool
     * (`confirm_health_document_index`, `ask_user`) leaves behind: no server
     * `execute`, so the run parks until the UI supplies the output.
     */
    unansweredToolCallCount?: number
    /**
     * Server tool calls whose `execute` threw. The SDK reports these as
     * `tool-error` content parts, NOT `tool-result` — they are answered all
     * the same, and go back to Anthropic as a tool_result.
     */
    toolErrorCount?: number
    /**
     * Provider-executed calls with no result in this step — Anthropic's
     * `web_search`, declared `supportsDeferredResults`, whose result arrives
     * in a later step. This is the shape of a `pause_turn`.
     */
    deferredProviderToolCallCount?: number
    finishReason?: string
    rawFinishReason?: string
    responseMessages?: unknown[]
  } = {}
) {
  const {
    text = 'here is your answer',
    toolCallCount = 0,
    unansweredToolCallCount = 0,
    toolErrorCount = 0,
    deferredProviderToolCallCount = 0,
    finishReason = 'stop',
    rawFinishReason = 'end_turn',
    responseMessages = [{ role: 'assistant', content: 'partial' }],
  } = overrides
  const attempt = uiStreamConfigs.length
  return {
    // Handed to the standalone `toUIMessageStream` mock below, which turns it
    // into a real stream — the route drains it chunk by chunk.
    stream: {
      toUiStream: () =>
        new ReadableStream<unknown>({
          start(controller) {
            controller.enqueue({ type: 'text-delta', id: `t${attempt}`, delta: text })
            controller.close()
          },
        }),
    },
    steps: Promise.resolve([
      {
        text,
        toolCalls: [
          ...Array.from({ length: toolCallCount }, (_, i) => ({ toolCallId: `c${i}` })),
          ...Array.from({ length: unansweredToolCallCount }, (_, i) => ({
            toolCallId: `pending${i}`,
          })),
          ...Array.from({ length: toolErrorCount }, (_, i) => ({ toolCallId: `err${i}` })),
          ...Array.from({ length: deferredProviderToolCallCount }, (_, i) => ({
            toolCallId: `deferred${i}`,
            providerExecuted: true,
          })),
        ],
        // The route reads `content`, the way the SDK reports a step's outputs:
        // answered calls appear as `tool-result` OR `tool-error` parts.
        content: [
          ...Array.from({ length: toolCallCount }, (_, i) => ({
            type: 'tool-result',
            toolCallId: `c${i}`,
          })),
          ...Array.from({ length: toolErrorCount }, (_, i) => ({
            type: 'tool-error',
            toolCallId: `err${i}`,
          })),
        ],
      },
    ]),
    finishReason: Promise.resolve(finishReason),
    rawFinishReason: Promise.resolve(rawFinishReason),
    usage: Promise.resolve({ outputTokens: 123 }),
    responseMessages: Promise.resolve(responseMessages),
  }
}

function resetState() {
  threadRow = { id: 'thread-1', user_id: '11111111-1111-4111-8111-111111111111' }
  messageCount = 1
  inserts = []
  updates = []
  insertErrors = []
  upsertOptions = []
  streamConfig = null
  responseInit = null
  writes = []
  uiStreamConfigs = []
  executed = Promise.resolve()
  mockGetUser.mockReset()
  mockStreamText.mockReset()
  mockWebSearchFactory.mockReset()
  mockBuildPrompt.mockReset()
  mockCreateLabTestTools.mockReset()
  mockConsumeStream.mockReset()
  mockGetUser.mockResolvedValue({ data: { user: { id: '11111111-1111-4111-8111-111111111111' } } })
  mockBuildPrompt.mockReturnValue('SYSTEM PROMPT BODY')
  mockCreateLabTestTools.mockReturnValue({}) // no lab tools needed for these assertions
}

function createBuilder(table: string) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: (data: unknown) => {
      inserts.push({ table, data })
      const error = table === 'chat_messages' ? (insertErrors.shift() ?? null) : null
      return Promise.resolve({ error })
    },
    upsert: (data: unknown, options: unknown) => {
      inserts.push({ table, data })
      upsertOptions.push(options)
      const error = table === 'chat_messages' ? (insertErrors.shift() ?? null) : null
      return Promise.resolve({ error })
    },
    update: (data: unknown) => {
      updates.push({ table, data })
      return {
        eq: () => Promise.resolve({ error: null }),
      }
    },
    single: () => Promise.resolve({ data: table === 'chat_threads' ? threadRow : null, error: null }),
    then: (resolve: (v: unknown) => unknown) =>
      resolve({ data: null, error: null, count: messageCount }),
  }
  return builder
}

// --- module mocks -----------------------------------------------------------
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (t: string) => createBuilder(t),
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (t: string) => createBuilder(t),
    storage: {
      from: () => ({
        download: async () => ({
          // 3 bytes — enough to prove the route downloaded + injected them.
          data: { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer },
          error: null,
        }),
      }),
    },
  },
}))
vi.mock('ai', () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
  convertToModelMessages: async (m: unknown) => m,
  isToolUIPart: (p: { type?: string }) =>
    p.type === 'dynamic-tool' || (p.type ?? '').startsWith('tool-'),
  isStepCount: () => undefined,
  toUIMessageStream: ({
    stream,
    ...cfg
  }: { stream: { toUiStream: () => ReadableStream<unknown> } } & Record<string, unknown>) => {
    uiStreamConfigs.push(cfg)
    return stream.toUiStream()
  },
  // Mirror the real SDK closely enough to exercise the route's turn loop:
  // `execute` is invoked with a writer, and we keep the promise so tests can
  // await the loop before asserting.
  createUIMessageStream: (cfg: UiStreamConfig) => {
    streamConfig = cfg
    executed = Promise.resolve(
      cfg.execute({
        writer: {
          write: (chunk: unknown) => writes.push(chunk),
          onError: undefined,
        },
      })
    )
    return { __uiStream: true }
  },
  createUIMessageStreamResponse: (init: Record<string, unknown>) => {
    responseInit = init
    return new Response('streamed', { status: 200 })
  },
  consumeStream: (...args: unknown[]) => mockConsumeStream(...args),
}))
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: Object.assign(
    (model: string) => ({ __model: model }),
    {
      tools: {
        webSearch_20250305: (opts: unknown) => {
          mockWebSearchFactory(opts)
          return { __providerTool: 'web_search_20250305', opts }
        },
      },
    }
  ),
}))
vi.mock('@/lib/insights/insights-chat-prompt', () => ({
  buildInsightsChatSystemPrompt: (...args: unknown[]) => mockBuildPrompt(...args),
}))
vi.mock('@/lib/insights/memory-tool', () => ({
  createMemoryTool: vi.fn(),
  loadMemoryForPrompt: vi.fn().mockResolvedValue(''),
}))
vi.mock('@/lib/labs/lab-test-tools', () => ({
  createLabTestTools: (...args: unknown[]) => mockCreateLabTestTools(...args),
}))
vi.mock('@/lib/insights/stack-tools', () => ({ createStackTools: () => ({}) }))
vi.mock('@/lib/insights/health-record-tools', () => ({
  createHealthRecordTools: () => ({}),
}))
vi.mock('@/lib/insights/profile-tools', () => ({ createProfileTools: () => ({}) }))
vi.mock('@/lib/insights/other-test-tools', () => ({ createOtherTestTools: () => ({}) }))
vi.mock('@/lib/insights/document-read-tools', () => ({ createDocumentReadTools: () => ({}) }))
// Isolate the doc-indexing graph (registry → entries → actions → Anthropic) the
// same way lab-test tools are mocked; these assertions only cover web_search.
vi.mock('@/lib/insights/document-index-tools', () => ({
  createDocumentIndexTools: () => ({}),
}))
vi.mock('@/lib/health-documents/registry', () => ({
  buildClassifierGuidance: () => '',
}))
vi.mock('@/lib/body/metrics', () => ({ gramsToKg: (g: number) => g / 1000 }))

import { POST } from '@/app/api/insights-chat/route'
import { liveRunCount, stopRun } from '@/lib/insights/run-registry'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/insights-chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_BODY = {
  threadId: 'thread-1',
  messages: [{ role: 'user', parts: [{ type: 'text', text: 'hi' }] }] as unknown,
}

describe('POST /api/insights-chat — web_search tool', () => {
  beforeEach(resetState)

  it('passes web_search tool to streamText with maxUses=5, appends "# Web search" to the system prompt, and enables sendSources', async () => {
    mockStreamText.mockReturnValue(fakeRun())

    const res = await POST(makeRequest(VALID_BODY))
    await executed
    expect(res.status).toBe(200)
    expect(mockStreamText).toHaveBeenCalledTimes(1)

    const args = mockStreamText.mock.calls[0][0] as {
      tools: Record<string, unknown>
      instructions: { content: string }
    }
    expect(args.tools.web_search).toBeDefined()
    expect((args.tools.web_search as { __providerTool: string }).__providerTool).toBe(
      'web_search_20250305'
    )
    expect(mockWebSearchFactory).toHaveBeenCalledWith({ maxUses: 5 })
    expect(args.instructions.content).toContain('# Web search')

    // Without sendSources:true the AI SDK silently drops the provider's
    // `source` parts, so web_search citations never reach the client or
    // persistence. This is the actual contract that makes the Sources footer work.
    expect(uiStreamConfigs).toHaveLength(1)
    expect(uiStreamConfigs[0].sendSources).toBe(true)
    expect(uiStreamConfigs[0].sendReasoning).toBe(true)
    expect(streamConfig?.onEnd).toBeTruthy()
  })

  it('persists source-url parts (citations) alongside tool parts so reloads keep them', async () => {
    mockStreamText.mockReturnValue(fakeRun())

    await POST(makeRequest(VALID_BODY))
    await executed
    expect(streamConfig?.onEnd).toBeTruthy()

    // Drive onEnd with a representative parts list.
    await streamConfig!.onEnd!({
      responseMessage: {
        parts: [
          { type: 'text', text: 'Recent research suggests …' },
          // a completed tool call (must still be saved)
          { type: 'tool-lab_test_finder', state: 'output-available', output: { hits: [] } },
          // an in-flight tool call (must NOT be saved — current behaviour)
          { type: 'tool-lab_test_finder', state: 'input-streaming' },
          // a source-url part from Anthropic web_search (MUST be saved now)
          {
            type: 'source-url',
            sourceId: 'src-1',
            url: 'https://pubmed.ncbi.nlm.nih.gov/12345',
            title: 'Reverse T3 in clinical practice',
          },
        ],
      },
    })

    const assistantInsert = inserts.find(
      (c) => c.table === 'chat_messages' && (c.data as { role?: string }).role === 'assistant'
    )
    expect(assistantInsert).toBeTruthy()
    const data = assistantInsert!.data as { content: string; tool_invocations: unknown[] | null }
    expect(data.content).toContain('Recent research suggests')
    expect(Array.isArray(data.tool_invocations)).toBe(true)
    const types = (data.tool_invocations ?? []).map((p) => (p as { type: string }).type)
    expect(types).toContain('source-url')
    expect(types).toContain('tool-lab_test_finder')
    // The in-flight tool call is filtered out.
    expect(types.filter((t) => t === 'tool-lab_test_finder')).toHaveLength(1)
  })

  it('injects uploaded attachments (from body) as content blocks on the last user message so the model can see them', async () => {
    mockStreamText.mockReturnValue(fakeRun())

    await POST(
      makeRequest({
        threadId: 'thread-1',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'this is what I tested' }] }],
        attachments: [
          { storagePath: '11111111-1111-4111-8111-111111111111/chat/33333333-3333-4333-8333-333333333331.jpg', mediaType: 'image/jpeg', filename: 'IMG_0849.JPG' },
          { storagePath: '11111111-1111-4111-8111-111111111111/chat/33333333-3333-4333-8333-333333333332.pdf', mediaType: 'application/pdf', filename: 'report.pdf' },
        ],
      })
    )

    const args = mockStreamText.mock.calls[0][0] as {
      messages: Array<{ role: string; content: unknown }>
    }
    const lastUser = args.messages[args.messages.length - 1]
    expect(lastUser.role).toBe('user')
    const content = lastUser.content as Array<{ type: string; mediaType?: string }>
    expect(Array.isArray(content)).toBe(true)
    const types = content.map((b) => b.type)
    expect(types).toContain('image')
    expect(types).toContain('file')
    expect(content.find((b) => b.type === 'image')?.mediaType).toBe('image/jpeg')
    expect(content.find((b) => b.type === 'file')?.mediaType).toBe('application/pdf')
  })

  it('refuses a request whose attachment belongs to a different user (authz guard)', async () => {
    mockStreamText.mockReturnValue(fakeRun())

    const res = await POST(
      makeRequest({
        threadId: 'thread-1',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
        attachments: [
          { storagePath: '22222222-2222-4222-8222-222222222222/chat/33333333-3333-4333-8333-333333333334.jpg', mediaType: 'image/jpeg', filename: 'x.jpg' },
        ],
      })
    )

    // Nothing is stored, downloaded or sent to the model.
    expect(res.status).toBe(400)
    expect(mockStreamText).not.toHaveBeenCalled()
  })

  it('refuses traversal in an attachment path, including in tiles', async () => {
    mockStreamText.mockReturnValue(fakeRun())

    const res = await POST(
      makeRequest({
        threadId: 'thread-1',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
        attachments: [
          {
            storagePath: '11111111-1111-4111-8111-111111111111/chat/33333333-3333-4333-8333-333333333335.jpg',
            parts: ['11111111-1111-4111-8111-111111111111/chat/../../22222222-2222-4222-8222-222222222222/chat/33333333-3333-4333-8333-333333333336.jpg'],
            mediaType: 'image/jpeg',
            filename: 'x.jpg',
          },
        ],
      })
    )

    expect(res.status).toBe(400)
    expect(mockStreamText).not.toHaveBeenCalled()
  })

  it("skips a foreign file in an earlier message's metadata instead of downloading it", async () => {
    mockStreamText.mockReturnValue(fakeRun())

    await POST(
      makeRequest({
        threadId: 'thread-1',
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'old' }],
            metadata: {
              attachments: [
                { storagePath: '22222222-2222-4222-8222-222222222222/chat/33333333-3333-4333-8333-333333333337.jpg', mediaType: 'image/jpeg', filename: 'x.jpg' },
              ],
            },
          },
          { role: 'assistant', parts: [{ type: 'text', text: 'ok' }] },
          { role: 'user', parts: [{ type: 'text', text: 'new' }] },
        ],
      })
    )

    const args = mockStreamText.mock.calls[0][0] as {
      messages: Array<{ role: string; content: unknown }>
    }
    const content = args.messages[0].content
    const types = Array.isArray(content)
      ? (content as Array<{ type: string }>).map((b) => b.type)
      : []
    expect(types).not.toContain('image')
  })

  it("re-attaches an earlier turn's upload so the model still sees it on a later turn", async () => {
    mockStreamText.mockReturnValue(fakeRun())

    await POST(
      makeRequest({
        threadId: 'thread-1',
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'here is my invoice' }],
            metadata: {
              attachments: [
                { storagePath: '11111111-1111-4111-8111-111111111111/chat/33333333-3333-4333-8333-333333333333.jpg', mediaType: 'image/jpeg', filename: 'inv.jpg' },
              ],
            },
          },
          { role: 'assistant', parts: [{ type: 'text', text: 'got it' }] },
          { role: 'user', parts: [{ type: 'text', text: 'reconcile it' }] }, // no upload this turn
        ],
        // no body.attachments this turn
      })
    )

    const args = mockStreamText.mock.calls[0][0] as {
      messages: Array<{ role: string; content: unknown }>
    }
    // The FIRST user message (the upload turn) still carries its image block.
    const uploadTurn = args.messages[0]
    const content = uploadTurn.content as Array<{ type: string }>
    expect(Array.isArray(content)).toBe(true)
    expect(content.map((b) => b.type)).toContain('image')
  })
})

describe('POST /api/insights-chat — a client that goes away mid-answer', () => {
  beforeEach(resetState)

  it('keeps the run going server-side so the whole reply is still saved', async () => {
    // A phone locking or switching apps cancels the response body,
    // which used to cascade back and fire onEnd on the half-written reply —
    // the rest was generated and thrown away. Teeing the stream and draining
    // the copy here keeps the run alive to its natural end, so the complete
    // answer reaches chat_messages and the client can pick it up again.
    mockStreamText.mockReturnValue(fakeRun())

    await POST(makeRequest(VALID_BODY))
    await executed

    // The response is handed a drain for its tee'd copy — that copy is what
    // keeps the source flowing once the client's half is cancelled.
    const drain = responseInit?.consumeSseStream as (o: { stream: unknown }) => void
    expect(typeof drain).toBe('function')
    const copy = new ReadableStream()
    drain({ stream: copy })
    expect(mockConsumeStream).toHaveBeenCalledWith({ stream: copy })
  })
})

describe('POST /api/insights-chat — Stop', () => {
  beforeEach(resetState)

  it('hands the run an abort signal the stop endpoint can reach', async () => {
    mockStreamText.mockReturnValue(fakeRun())

    await POST(makeRequest(VALID_BODY))
    await executed

    // Without this the composer's Stop is a client-only gesture: the server
    // treats a vanished client as a dropped connection and keeps generating,
    // deliberately, so the answer survives a phone losing signal.
    const args = mockStreamText.mock.calls[0][0] as { abortSignal?: AbortSignal }
    expect(args.abortSignal).toBeInstanceOf(AbortSignal)
    expect(args.abortSignal?.aborted).toBe(false)
    // And the run is deregistered once the turn is over, so a later stop for
    // that thread finds nothing rather than aborting a stranger's run.
    expect(liveRunCount()).toBe(0)
  })

  it('does not resume a turn the user stopped', async () => {
    // A stopped turn has no text and does have tool calls — the cut-short
    // shape. Resuming it would spend another model call on an answer the user
    // just cancelled.
    mockStreamText.mockImplementation(() => {
      const run = fakeRun({ text: '', toolCallCount: 1 })
      const args = mockStreamText.mock.calls.at(-1)?.[0] as { abortSignal?: AbortSignal }
      stopRun('thread-1') // the stop endpoint, arriving mid-run
      expect(args.abortSignal?.aborted).toBe(true)
      return run
    })

    await POST(makeRequest(VALID_BODY))
    await executed

    expect(mockStreamText).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/insights-chat — turns that end cut short', () => {
  beforeEach(resetState)

  it('resumes a turn that ran tools but wrote no answer, into the same message', async () => {
    // The production failure (thread 4cce6690…, 2026-08-20 10:15 UTC): two
    // web_search calls, 19 citations, two lab_test_finder calls, zero text and
    // no error. Anthropic pauses long server-tool turns; the SDK reports that
    // as a plain `stop`, so the run just ended and an empty reply was saved.
    mockStreamText
      .mockReturnValueOnce(fakeRun({ text: '', toolCallCount: 2 }))
      .mockReturnValueOnce(fakeRun({ text: 'Fluoride can compete with iodine…' }))

    const res = await POST(makeRequest(VALID_BODY))
    await executed

    expect(res.status).toBe(200)
    expect(mockStreamText).toHaveBeenCalledTimes(2)

    // The resumed call carries the first attempt's own response messages back,
    // which is Anthropic's documented way to continue a paused turn.
    const second = mockStreamText.mock.calls[1][0] as {
      messages: Array<{ role: string; content: unknown }>
    }
    expect(second.messages.at(-1)).toEqual({ role: 'assistant', content: 'partial' })

    // One bubble, not two: only the first attempt opens the message, neither
    // closes it, and a single `finish` is written once the loop is done.
    expect(uiStreamConfigs).toHaveLength(2)
    expect(uiStreamConfigs[0].sendStart).toBe(true)
    expect(uiStreamConfigs[1].sendStart).toBe(false)
    expect(uiStreamConfigs.every((c) => c.sendFinish === false)).toBe(true)
    // Both attempts' chunks reach the client, and `finish` comes last — never
    // overtaking the words of the resumed answer.
    expect(writes).toHaveLength(3)
    expect(writes.at(-1)).toEqual({ type: 'finish' })
    expect(
      (writes[1] as { delta: string }).delta
    ).toBe('Fluoride can compete with iodine…')
  })

  it('does not resume a turn that is waiting for the user to answer a card', async () => {
    // OTH-39: `extract_health_document` (answered) then
    // `confirm_health_document_index` (no server execute — the "Log it to my
    // record / Just this chat" card). No text was written, so the cut-short
    // rule used to match and the loop re-sent the conversation with an
    // unanswered `tool_use` block. Anthropic rejected it and the user saw
    // "Tool result is missing for tool call toolu_…" under the card.
    mockStreamText.mockReturnValue(
      fakeRun({ text: '', toolCallCount: 1, unansweredToolCallCount: 1 })
    )

    await POST(makeRequest(VALID_BODY))
    await executed

    expect(mockStreamText).toHaveBeenCalledTimes(1)
    expect(writes.at(-1)).toEqual({ type: 'finish' })
  })

  it('still resumes a paused turn whose web_search result has not arrived yet', async () => {
    // Anthropic's web_search is declared `supportsDeferredResults`, so its
    // result comes back in a LATER step — a final step holding a
    // provider-executed call with no result IS the pause_turn shape, not a
    // turn waiting on the user. Treating it as the latter switched the OTH-38
    // resume off for the exact production failure it was written for.
    mockStreamText
      .mockReturnValueOnce(
        fakeRun({ text: '', toolCallCount: 1, deferredProviderToolCallCount: 1 })
      )
      .mockReturnValueOnce(fakeRun({ text: 'Fluoride can compete with iodine…' }))

    await POST(makeRequest(VALID_BODY))
    await executed

    expect(mockStreamText).toHaveBeenCalledTimes(2)
  })

  it('still resumes a cut-short turn whose last tool call failed', async () => {
    // A server tool whose execute threw is reported as a `tool-error` part,
    // never a `tool-result`. It is answered all the same — Anthropic gets a
    // tool_result back — so it must not read as "waiting for the user".
    mockStreamText
      .mockReturnValueOnce(fakeRun({ text: '', toolErrorCount: 1 }))
      .mockReturnValueOnce(fakeRun({ text: 'That lookup failed, but here is…' }))

    await POST(makeRequest(VALID_BODY))
    await executed

    expect(mockStreamText).toHaveBeenCalledTimes(2)
  })

  it('leaves a turn that produced an answer alone', async () => {
    // Resuming a finished turn would append a second, regenerated answer to the
    // same bubble — the OTH-18 failure mode.
    mockStreamText.mockReturnValue(fakeRun({ text: 'done', toolCallCount: 2 }))

    await POST(makeRequest(VALID_BODY))
    await executed

    expect(mockStreamText).toHaveBeenCalledTimes(1)
    expect(writes.at(-1)).toEqual({ type: 'finish' })
  })

  it('resumes when the provider reports pause_turn even though text was written', async () => {
    mockStreamText
      .mockReturnValueOnce(
        fakeRun({ text: 'Looking at the fluoride data…', rawFinishReason: 'pause_turn' })
      )
      .mockReturnValueOnce(fakeRun({ text: '…here is the conclusion.' }))

    await POST(makeRequest(VALID_BODY))
    await executed

    expect(mockStreamText).toHaveBeenCalledTimes(2)
  })

  it('gives up after the continuation budget instead of looping', async () => {
    mockStreamText.mockReturnValue(fakeRun({ text: '', toolCallCount: 1 }))

    await POST(makeRequest(VALID_BODY))
    await executed

    // MAX_TURN_CONTINUATIONS = 2, so one original attempt plus two resumes.
    expect(mockStreamText).toHaveBeenCalledTimes(3)
    expect(writes.at(-1)).toEqual({ type: 'finish' })
  })
})

describe('POST /api/insights-chat — saving messages', () => {
  beforeEach(resetState)

  it('stops with a 500 before running the model when the question cannot be saved', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockStreamText.mockReturnValue(fakeRun())
    insertErrors = [{ message: 'insert failed' }]

    const res = await POST(makeRequest(VALID_BODY))

    expect(res.status).toBe(500)
    expect(mockStreamText).not.toHaveBeenCalled()
  })

  it('retries saving the reply once when the first insert fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockStreamText.mockReturnValue(fakeRun())
    await POST(makeRequest(VALID_BODY))
    await executed

    insertErrors = [{ message: 'temporary failure' }]
    await streamConfig!.onEnd!({ responseMessage: { parts: [{ type: 'text', text: 'Answer' }] } })

    const replies = inserts.filter(
      (c) => c.table === 'chat_messages' && (c.data as { role?: string }).role === 'assistant'
    )
    // The queued failure was consumed by the first reply insert, so the
    // second insert is the retry.
    expect(insertErrors).toHaveLength(0)
    expect(replies).toHaveLength(2)
    // Same row incl. a fixed id, retried as an upsert that ignores a
    // duplicate, so a lost-response retry cannot store the reply twice.
    expect(replies[0].data).toEqual(replies[1].data)
    expect((replies[0].data as { id?: string }).id).toMatch(/^[0-9a-f-]{36}$/)
    expect(upsertOptions).toEqual([{ onConflict: 'id', ignoreDuplicates: true }])
    expect(console.error).not.toHaveBeenCalledWith(
      '[insights-chat] could not save the assistant reply',
      expect.anything()
    )
  })
})


describe('POST /api/insights-chat — prompt caching', () => {
  beforeEach(resetState)

  it('turns on automatic prompt caching without changing thinking or effort', async () => {
    mockStreamText.mockReturnValue(fakeRun())
    await POST(makeRequest(VALID_BODY))
    await executed

    const args = mockStreamText.mock.calls[0][0] as {
      providerOptions: { anthropic: Record<string, unknown> }
    }
    expect(args.providerOptions.anthropic).toEqual({
      thinking: { type: 'adaptive' },
      effort: 'high',
      cacheControl: { type: 'ephemeral' },
    })
  })

  it('also caches the system prompt with its own breakpoint', async () => {
    mockStreamText.mockReturnValue(fakeRun())
    await POST(makeRequest(VALID_BODY))
    await executed

    const args = mockStreamText.mock.calls[0][0] as {
      instructions: { role: string; content: string; providerOptions: unknown }
    }
    expect(args.instructions.role).toBe('system')
    expect(args.instructions.content).toContain('# Web search')
    expect(args.instructions.providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    })
  })
})

describe('POST /api/insights-chat — approval cards', () => {
  beforeEach(resetState)

  const answeredCard = {
    type: 'tool-delete_blood_test',
    toolCallId: 'c-del',
    state: 'approval-responded',
    input: { testId: 'bt-1' },
    approval: { id: 'ap-1', approved: true },
  }

  it('continues the asking message and saves only what the resumed run added', async () => {
    mockStreamText.mockReturnValue(fakeRun())

    await POST(
      makeRequest({
        threadId: 'thread-1',
        messages: [
          { role: 'user', parts: [{ type: 'text', text: 'delete my June test' }] },
          { id: 'a-1', role: 'assistant', parts: [{ type: 'text', text: 'Deleting it.' }, answeredCard] },
        ],
      })
    )
    await executed

    // The stream continues the assistant message the card lives on.
    expect(streamConfig!.originalMessages).toHaveLength(2)
    // No user row: the last message is the assistant's.
    expect(inserts.filter((i) => i.table === 'chat_messages')).toHaveLength(0)

    await streamConfig!.onEnd!({
      responseMessage: {
        parts: [
          { type: 'text', text: 'Deleting it.' },
          { ...answeredCard, state: 'output-available', output: { deleted: { id: 'bt-1' } } },
          { type: 'text', text: 'Done.' },
        ],
      },
    })
    const row = inserts.find((i) => i.table === 'chat_messages')!.data as {
      content: string
      tool_invocations: Array<{ toolCallId: string }>
    }
    // The text before the card was saved by the run that asked.
    expect(row.content).toBe('Done.')
    expect(row.tool_invocations.map((p) => p.toolCallId)).toEqual(['c-del'])
  })

  it('starts a fresh message for an ordinary user turn', async () => {
    mockStreamText.mockReturnValue(fakeRun())
    await POST(makeRequest(VALID_BODY))
    await executed
    expect(streamConfig!.originalMessages).toBeUndefined()
  })
})
