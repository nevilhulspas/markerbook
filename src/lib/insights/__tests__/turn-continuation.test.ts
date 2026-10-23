import { describe, it, expect } from 'vitest'

import {
  shouldContinueTurn,
  MAX_TURN_CONTINUATIONS,
  PAUSE_TURN,
  type TurnEnd,
} from '../turn-continuation'

/** A run that finished normally with a written answer. */
function completed(overrides: Partial<TurnEnd> = {}): TurnEnd {
  return {
    finishReason: 'stop',
    rawFinishReason: 'end_turn',
    hasText: true,
    hasToolCalls: false,
    ...overrides,
  }
}

describe('shouldContinueTurn', () => {
  it('resumes the turn that produced tool steps and sources but no answer', () => {
    // The production failure (thread 4cce6690…, 2026-08-20 10:15 UTC): two
    // web_search calls, 19 citations, two lab_test_finder calls, zero text,
    // no error logged. `stop` is what the SDK reports for a paused turn.
    expect(
      shouldContinueTurn(
        completed({ hasText: false, hasToolCalls: true }),
        0,
      ),
    ).toBe(true)
  })

  it('resumes when the provider reports pause_turn, even with text so far', () => {
    expect(
      shouldContinueTurn(
        completed({ rawFinishReason: PAUSE_TURN, hasToolCalls: true }),
        0,
      ),
    ).toBe(true)
  })

  it('resumes a turn the step cap ended mid-work, even with a progress note', () => {
    // OTH-43: "Ik log eerst je gewichten…" then tool calls in the last allowed
    // step — the model never got a step to read their results and answer.
    expect(
      shouldContinueTurn(
        completed({ finishReason: 'tool-calls', rawFinishReason: 'tool_use', hasToolCalls: true }),
        0,
      ),
    ).toBe(true)
  })

  it('does not resume a step-capped turn that waits for the user', () => {
    expect(
      shouldContinueTurn(
        completed({
          finishReason: 'tool-calls',
          rawFinishReason: 'tool_use',
          hasToolCalls: true,
          awaitsToolResults: true,
        }),
        0,
      ),
    ).toBe(false)
  })

  it('leaves a genuinely finished turn alone', () => {
    expect(shouldContinueTurn(completed(), 0)).toBe(false)
    expect(shouldContinueTurn(completed({ hasToolCalls: true }), 0)).toBe(false)
  })

  it('does not resume an empty turn that made no tool calls', () => {
    // Nothing happened to be cut short — resending would spin.
    expect(
      shouldContinueTurn(completed({ hasText: false, hasToolCalls: false }), 0),
    ).toBe(false)
  })

  it('does not resume a turn that is waiting for the user to answer a card', () => {
    // The run ended on `confirm_health_document_index` — a tool with no
    // server execute. Its `tool_use` block has no result yet, so resending the
    // conversation is exactly what Anthropic rejects with "Tool result is
    // missing for tool call toolu_…". Text-less + tool calls would otherwise
    // match the cut-short rule below.
    expect(
      shouldContinueTurn(
        completed({ hasText: false, hasToolCalls: true, awaitsToolResults: true }),
        0,
      ),
    ).toBe(false)
  })

  it('does not resume a paused turn that still awaits a tool result', () => {
    // The guard outranks pause_turn: an unanswered tool_use is a 400 whatever
    // the provider's stop reason was.
    expect(
      shouldContinueTurn(
        completed({
          rawFinishReason: PAUSE_TURN,
          hasToolCalls: true,
          awaitsToolResults: true,
        }),
        0,
      ),
    ).toBe(false)
  })

  it('still resumes a cut-short turn whose tool calls all returned results', () => {
    // web_search and our own server tools resolve inside their step, so
    // awaitsToolResults stays false — the OTH-38 resume keeps working.
    expect(
      shouldContinueTurn(
        completed({ hasText: false, hasToolCalls: true, awaitsToolResults: false }),
        0,
      ),
    ).toBe(true)
  })

  it('does not resume after an abort — the client is gone', () => {
    expect(
      shouldContinueTurn(
        completed({ hasText: false, hasToolCalls: true, isAborted: true }),
        0,
      ),
    ).toBe(false)
  })

  it('does not resume a hard failure or a refusal', () => {
    for (const finishReason of ['error', 'content-filter']) {
      expect(
        shouldContinueTurn(
          completed({ finishReason, hasText: false, hasToolCalls: true }),
          0,
        ),
      ).toBe(false)
    }
  })

  it('stops once the continuation budget is spent', () => {
    const cutShort = completed({ hasText: false, hasToolCalls: true })
    expect(shouldContinueTurn(cutShort, MAX_TURN_CONTINUATIONS - 1)).toBe(true)
    expect(shouldContinueTurn(cutShort, MAX_TURN_CONTINUATIONS)).toBe(false)
  })
})
