import { describe, it, expect } from 'vitest'
import type { UIMessage } from 'ai'
import {
  INTERACTIVE_TOOLS,
  CLIENT_ANSWERED_TOOLS,
  hasUnansweredInteractiveTool,
  lastAssistantMessageAwaitsInteractiveTool,
} from '../chat-continuation'

type Part = UIMessage['parts'][number]

function assistant(parts: Part[]): UIMessage {
  return { id: 'a1', role: 'assistant', parts }
}
function toolPart(
  name: string,
  state: 'output-available' | 'output-error' | 'input-available' | 'input-streaming',
  extra: Record<string, unknown> = {},
): Part {
  return {
    type: `tool-${name}`,
    toolCallId: `call-${name}`,
    state,
    input: {},
    ...(state === 'output-available' ? { output: {} } : {}),
    ...(state === 'output-error' ? { errorText: 'boom' } : {}),
    ...extra,
  } as unknown as Part
}
const text = (t: string): Part => ({ type: 'text', text: t }) as Part
const stepStart = (): Part => ({ type: 'step-start' }) as Part

describe('lastAssistantMessageAwaitsInteractiveTool', () => {
  it('fires when the last step ends with a completed interactive tool (ask_user answered)', () => {
    const messages = [
      assistant([stepStart(), text('Which date?'), toolPart('ask_user', 'output-available')]),
    ]
    expect(lastAssistantMessageAwaitsInteractiveTool({ messages })).toBe(true)
  })

  it('does NOT fire while the interactive tool is still awaiting the user', () => {
    const messages = [
      assistant([stepStart(), text('Which date?'), toolPart('ask_user', 'input-available')]),
    ]
    expect(lastAssistantMessageAwaitsInteractiveTool({ messages })).toBe(false)
  })

  it('does NOT fire when a turn ends after completed SERVER tools (the OTH-18 duplication trigger)', () => {
    const messages = [
      assistant([
        stepStart(),
        text('Let me retry the ones that did not resolve.'),
        toolPart('add_blood_results', 'output-available'),
      ]),
    ]
    expect(lastAssistantMessageAwaitsInteractiveTool({ messages })).toBe(false)
  })

  it('does NOT fire for build_lab_test_lists — custom UI but SERVER-executed (has execute)', () => {
    const messages = [
      assistant([
        stepStart(),
        text('Here are your lab lists.'),
        toolPart('build_lab_test_lists', 'output-available'),
      ]),
    ]
    expect(lastAssistantMessageAwaitsInteractiveTool({ messages })).toBe(false)
  })

  it('does NOT fire when the last step is text-only (normal completed turn)', () => {
    const messages = [
      assistant([
        stepStart(),
        toolPart('add_blood_results', 'output-available'),
        stepStart(),
        text('All done — summary here.'),
      ]),
    ]
    expect(lastAssistantMessageAwaitsInteractiveTool({ messages })).toBe(false)
  })

  it('only inspects the LAST step: an answered ask_user in an EARLIER step does not re-fire', () => {
    const messages = [
      assistant([
        stepStart(),
        toolPart('ask_user', 'output-available'),
        stepStart(),
        text('Continuing after your answer…'),
        toolPart('add_blood_results', 'output-available'),
      ]),
    ]
    expect(lastAssistantMessageAwaitsInteractiveTool({ messages })).toBe(false)
  })

  it('fires for a mixed final step once the interactive result arrives and server tools are done', () => {
    const messages = [
      assistant([
        stepStart(),
        toolPart('add_blood_results', 'output-available'),
        toolPart('ask_user', 'output-available'),
      ]),
    ]
    expect(lastAssistantMessageAwaitsInteractiveTool({ messages })).toBe(true)
  })

  it('does NOT fire for a mixed final step while a server tool is still running', () => {
    const messages = [
      assistant([
        stepStart(),
        toolPart('add_blood_results', 'input-streaming'),
        toolPart('ask_user', 'output-available'),
      ]),
    ]
    expect(lastAssistantMessageAwaitsInteractiveTool({ messages })).toBe(false)
  })

  it('treats output-error as complete (matches stock predicate semantics)', () => {
    const messages = [
      assistant([stepStart(), toolPart('ask_user', 'output-error')]),
    ]
    expect(lastAssistantMessageAwaitsInteractiveTool({ messages })).toBe(true)
  })

  it('ignores provider-executed tools (web_search) in the final step', () => {
    const messages = [
      assistant([
        stepStart(),
        toolPart('web_search', 'output-available', { providerExecuted: true }),
        text('Search-informed answer.'),
      ]),
    ]
    expect(lastAssistantMessageAwaitsInteractiveTool({ messages })).toBe(false)
  })

  it('does NOT fire for user messages or empty transcripts', () => {
    expect(lastAssistantMessageAwaitsInteractiveTool({ messages: [] })).toBe(false)
    const messages = [{ id: 'u1', role: 'user', parts: [text('hi')] } as UIMessage]
    expect(lastAssistantMessageAwaitsInteractiveTool({ messages })).toBe(false)
  })

  it('fires for confirm_health_document_index once answered (client-answered tool)', () => {
    const messages = [
      assistant([stepStart(), toolPart('confirm_health_document_index', 'output-available')]),
    ]
    expect(lastAssistantMessageAwaitsInteractiveTool({ messages })).toBe(true)
  })

  it('keeps the tool lists in sync: client-answered ⊂ interactive, and build_lab_test_lists is render-only', () => {
    expect(INTERACTIVE_TOOLS).toEqual([
      'ask_user',
      'build_lab_test_lists',
      'confirm_health_document_index',
    ])
    expect(CLIENT_ANSWERED_TOOLS).toEqual(['ask_user', 'confirm_health_document_index'])
    // Every client-answered tool must also get interactive rendering…
    CLIENT_ANSWERED_TOOLS.forEach((t) => expect(INTERACTIVE_TOOLS).toContain(t))
    // …and the server-executed card tool must never trigger auto-resume.
    expect(CLIENT_ANSWERED_TOOLS).not.toContain('build_lab_test_lists')
  })
})

describe('hasUnansweredInteractiveTool', () => {
  it('sees a document card still waiting for the click', () => {
    expect(
      hasUnansweredInteractiveTool([
        assistant([
          text('I found a blood panel from 12 March — log it?'),
          toolPart('confirm_health_document_index', 'input-available'),
        ]),
      ]),
    ).toBe(true)
  })

  it('sees an unanswered question prompt', () => {
    expect(
      hasUnansweredInteractiveTool([assistant([toolPart('ask_user', 'input-available')])]),
    ).toBe(true)
  })

  it('is false once the card has been answered', () => {
    expect(
      hasUnansweredInteractiveTool([
        assistant([toolPart('confirm_health_document_index', 'output-available')]),
      ]),
    ).toBe(false)
  })

  it('ignores server-executed tools that are still running', () => {
    // Those resolve on their own; only a card needs the user.
    expect(
      hasUnansweredInteractiveTool([assistant([toolPart('build_lab_test_lists', 'input-available')])]),
    ).toBe(false)
  })

  it('is false for a plain answer, and for a user turn', () => {
    expect(hasUnansweredInteractiveTool([assistant([text('Your TSH is fine.')])])).toBe(false)
    expect(
      hasUnansweredInteractiveTool([{ id: 'u1', role: 'user', parts: [text('hi')] } as UIMessage]),
    ).toBe(false)
    expect(hasUnansweredInteractiveTool([])).toBe(false)
  })
})

describe('approval cards (tool-approval.ts)', () => {
  const approvalPart = (state: string, approved?: boolean): Part =>
    ({
      type: 'tool-delete_blood_test',
      toolCallId: 'call-delete',
      state,
      input: { testId: 't1' },
      approval: { id: 'ap-1', ...(approved === undefined ? {} : { approved }) },
    }) as unknown as Part

  it('resumes once the user answered the card — confirm or cancel', () => {
    for (const approved of [true, false]) {
      const messages = [assistant([stepStart(), text('Deleting it.'), approvalPart('approval-responded', approved)])]
      expect(lastAssistantMessageAwaitsInteractiveTool({ messages })).toBe(true)
    }
  })

  it('does NOT resume while the card is still open', () => {
    const messages = [assistant([stepStart(), approvalPart('approval-requested')])]
    expect(lastAssistantMessageAwaitsInteractiveTool({ messages })).toBe(false)
  })

  it('does NOT resume while another card in the same step is still open', () => {
    const messages = [
      assistant([
        stepStart(),
        approvalPart('approval-responded', true),
        { ...(approvalPart('approval-requested') as object), toolCallId: 'call-2' } as Part,
      ]),
    ]
    expect(lastAssistantMessageAwaitsInteractiveTool({ messages })).toBe(false)
  })

  it('still never resumes on a finished SERVER tool of an approval-gated name', () => {
    const messages = [assistant([stepStart(), toolPart('delete_blood_test', 'output-available')])]
    expect(lastAssistantMessageAwaitsInteractiveTool({ messages })).toBe(false)
  })

  it('counts an open card as unanswered (keeps the stored copy from replacing it)', () => {
    expect(hasUnansweredInteractiveTool([assistant([approvalPart('approval-requested')])])).toBe(true)
    expect(hasUnansweredInteractiveTool([assistant([approvalPart('output-denied')])])).toBe(false)
  })
})
