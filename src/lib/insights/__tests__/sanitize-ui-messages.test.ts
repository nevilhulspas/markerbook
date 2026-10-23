import { describe, it, expect } from 'vitest'
import type { UIMessage } from 'ai'

import { sanitizeUiMessages } from '../sanitize-ui-messages'

// Helper: build a UIMessage with arbitrary parts so tests can lean on
// structural typing rather than the AI SDK's exhaustive UIMessage shape.
function msg(
  role: 'user' | 'assistant',
  parts: Array<Record<string, unknown>>
): UIMessage {
  return { id: `${role}-${Math.random()}`, role, parts } as UIMessage
}

describe('sanitizeUiMessages', () => {
  it('passes user messages through untouched', () => {
    const m = msg('user', [{ type: 'text', text: 'hi' }])
    const out = sanitizeUiMessages([m])
    // Same reference — no allocation when no edits needed.
    expect(out[0]).toBe(m)
  })

  it('keeps assistant text + completed tool parts unchanged', () => {
    const m = msg('assistant', [
      { type: 'text', text: 'sure, let me look' },
      {
        type: 'tool-lookupMarkerHistory',
        toolCallId: 'a',
        state: 'output-available',
        input: { markerName: 'TSH' },
        output: { history: [] },
      },
      { type: 'text', text: 'done.' },
    ])
    const out = sanitizeUiMessages([m])
    expect(out[0]).toBe(m)
  })

  it('strips assistant tool parts whose state never reached output-available', () => {
    // Real-world repro: a tool call started streaming, the network dropped,
    // and the client retained the half-streamed part. The Anthropic API
    // would refuse the next submit with "tool_use ids were found without
    // tool_result blocks".
    const m = msg('assistant', [
      { type: 'text', text: 'looking it up' },
      {
        type: 'tool-web_search',
        toolCallId: 'in-flight-1',
        state: 'input-available',
        input: { query: 'lactoferrin' },
      },
      {
        type: 'dynamic-tool',
        toolCallId: 'in-flight-2',
        state: 'input-streaming',
        input: { partial: true },
      },
    ])
    const out = sanitizeUiMessages([m]) as Array<{
      parts: Array<{ type: string }>
    }>
    expect(out[0].parts.map((p) => p.type)).toEqual(['text'])
  })

  it('keeps output-error tool parts (they emit a tool_result)', () => {
    // Output-error still produces a tool_result block in convertToModelMessages
    // (carrying the error). Anthropic accepts that; only the bare input states
    // are unsafe to send.
    const m = msg('assistant', [
      {
        type: 'tool-lab_test_finder',
        toolCallId: 'errored',
        state: 'output-error',
        input: {},
        errorText: 'boom',
      },
    ])
    const out = sanitizeUiMessages([m])
    expect(out[0]).toBe(m)
  })

  it('preserves message order and only edits affected messages', () => {
    const a = msg('user', [{ type: 'text', text: 'hey' }])
    const b = msg('assistant', [
      { type: 'text', text: 'hi' },
      {
        type: 'tool-add_to_next_to_test',
        toolCallId: 'leftover',
        state: 'input-available',
        input: { biomarkerName: 'TSH' },
      },
    ])
    const c = msg('user', [{ type: 'text', text: 'go on' }])
    const out = sanitizeUiMessages([a, b, c])
    expect(out).toHaveLength(3)
    expect(out[0]).toBe(a)
    expect(out[2]).toBe(c)
    // The affected message was cloned (not mutated in place) and lost the
    // unfinished tool part.
    expect(out[1]).not.toBe(b)
    expect(
      (out[1].parts as Array<{ type: string }>).map((p) => p.type)
    ).toEqual(['text'])
  })

  it('survives messages with no parts', () => {
    const m = msg('assistant', [])
    expect(() => sanitizeUiMessages([m])).not.toThrow()
  })
})

describe('sanitizeUiMessages — approval cards', () => {
  const part = (state: string) => ({
    type: 'tool-delete_blood_test',
    toolCallId: `c-${state}`,
    state,
    input: { testId: 't1' },
    approval: { id: 'ap', approved: true },
  })

  it('keeps an answered card on the LAST message (the server runs the tool from it)', () => {
    const out = sanitizeUiMessages([msg('user', [{ type: 'text', text: 'x' }]), msg('assistant', [part('approval-responded')])])
    expect(out[1].parts).toHaveLength(1)
  })

  it('drops an answered card on an earlier message and an unanswered card anywhere', () => {
    const out = sanitizeUiMessages([
      msg('assistant', [part('approval-responded')]),
      msg('user', [{ type: 'text', text: 'x' }]),
      msg('assistant', [part('approval-requested')]),
    ])
    expect(out[0].parts).toHaveLength(0)
    expect(out[2].parts).toHaveLength(0)
  })

  it('keeps a declined card (it becomes a tool_result for the model)', () => {
    const out = sanitizeUiMessages([msg('assistant', [part('output-denied')]), msg('user', [{ type: 'text', text: 'x' }])])
    expect(out[0].parts).toHaveLength(1)
  })
})
