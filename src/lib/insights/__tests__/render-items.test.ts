import { describe, it, expect } from 'vitest'
import type { UIMessage } from 'ai'
import {
  askUserAnswerText,
  attachmentsOf,
  buildRenderItems,
  isImageAttachment,
  lastTextIndex,
  messageText,
  sourcePartsOf,
  tailIsStreamingText,
  toolNameOf,
  type RenderItem,
} from '../render-items'

type Part = UIMessage['parts'][number]

const text = (t: string): Part => ({ type: 'text', text: t }) as Part
const reasoning = (t: string): Part => ({ type: 'reasoning', text: t }) as Part
const stepStart = (): Part => ({ type: 'step-start' }) as Part
const source = (url: string, title?: string): Part =>
  ({ type: 'source-url', sourceId: url, url, title }) as Part
function tool(name: string, id: string, state = 'output-available'): Part {
  return {
    type: `tool-${name}`,
    toolCallId: id,
    state,
    input: { q: id },
    output: { ok: true },
  } as unknown as Part
}

describe('toolNameOf', () => {
  it('strips the tool- prefix from the part type', () => {
    expect(toolNameOf({ type: 'tool-ask_user' })).toBe('ask_user')
  })

  it('prefers an explicit name', () => {
    expect(toolNameOf({ name: 'web_search', type: 'tool-other' })).toBe('web_search')
  })

  it('only strips the first occurrence', () => {
    expect(toolNameOf({ type: 'tool-tool-x' })).toBe('tool-x')
  })

  it('reads toolName on a dynamic-tool part', () => {
    expect(toolNameOf({ type: 'dynamic-tool', toolName: 'ask_user' })).toBe('ask_user')
  })

  it('falls back to the type for a dynamic-tool part without a toolName', () => {
    expect(toolNameOf({ type: 'dynamic-tool' })).toBe('dynamic-tool')
  })
})

describe('buildRenderItems', () => {
  it('returns nothing for no parts', () => {
    expect(buildRenderItems([])).toEqual([])
  })

  it('merges consecutive text parts', () => {
    expect(buildRenderItems([text('Hel'), text('lo')])).toEqual([
      { kind: 'text', text: 'Hello' },
    ])
  })

  it('treats a missing text as empty', () => {
    expect(buildRenderItems([{ type: 'text' }])).toEqual([{ kind: 'text', text: '' }])
  })

  it('ignores step-start, reasoning, source-url and untyped parts without breaking merges', () => {
    const items = buildRenderItems([
      text('a'),
      stepStart(),
      reasoning('thinking'),
      source('https://example.com'),
      {},
      text('b'),
    ])
    expect(items).toEqual([{ kind: 'text', text: 'ab' }])
  })

  it('groups consecutive background tool calls into one activity item', () => {
    const a = tool('lookupMarkerHistory', 'c1')
    const b = tool('web_search', 'c2', 'input-streaming')
    const items = buildRenderItems([a, b])
    expect(items).toEqual([{ kind: 'activity', parts: [a, b] }])
    // The original part objects are passed through, not copies.
    expect((items[0] as Extract<RenderItem, { kind: 'activity' }>).parts[0]).toBe(a)
  })

  it('splits activity groups around text', () => {
    const a = tool('list_stack', 'c1')
    const b = tool('list_wishlist', 'c2')
    expect(buildRenderItems([a, text('mid'), b])).toEqual([
      { kind: 'activity', parts: [a] },
      { kind: 'text', text: 'mid' },
      { kind: 'activity', parts: [b] },
    ])
  })

  it('renders every interactive tool as its own item, never grouped', () => {
    const ask = tool('ask_user', 'c1', 'input-available')
    const lists = tool('build_lab_test_lists', 'c2')
    const doc = tool('confirm_health_document_index', 'c3')
    expect(buildRenderItems([ask, lists, doc])).toEqual([
      { kind: 'interactive', part: ask },
      { kind: 'interactive', part: lists },
      { kind: 'interactive', part: doc },
    ])
  })

  it('an interactive part breaks an activity group in two', () => {
    const a = tool('list_stack', 'c1')
    const ask = tool('ask_user', 'c2')
    const b = tool('list_wishlist', 'c3')
    expect(buildRenderItems([a, ask, b])).toEqual([
      { kind: 'activity', parts: [a] },
      { kind: 'interactive', part: ask },
      { kind: 'activity', parts: [b] },
    ])
  })

  it('keeps stream order across text, activity and interactive parts', () => {
    const a = tool('lab_test_finder', 'c1')
    const ask = tool('ask_user', 'c2')
    expect(
      buildRenderItems([text('Let me check.'), a, text('Found it. '), text('Which lab?'), ask])
    ).toEqual([
      { kind: 'text', text: 'Let me check.' },
      { kind: 'activity', parts: [a] },
      { kind: 'text', text: 'Found it. Which lab?' },
      { kind: 'interactive', part: ask },
    ])
  })

  it('matches interactive tools by an explicit name too', () => {
    const p = { type: 'tool-whatever', name: 'ask_user', toolCallId: 'c1', state: 'input-available' }
    expect(buildRenderItems([p])).toEqual([{ kind: 'interactive', part: p }])
  })

  it('routes a dynamic-tool part by its toolName', () => {
    const ask = {
      type: 'dynamic-tool',
      toolName: 'ask_user',
      toolCallId: 'c1',
      state: 'input-available',
    }
    const search = { ...ask, toolName: 'web_search', toolCallId: 'c2' }
    expect(buildRenderItems([ask, search])).toEqual([
      { kind: 'interactive', part: ask },
      { kind: 'activity', parts: [search] },
    ])
  })

  it('does not mutate the input parts', () => {
    const parts = [text('a'), text('b')]
    buildRenderItems(parts)
    expect(parts).toEqual([text('a'), text('b')])
  })
})

describe('messageText', () => {
  it('joins only the text parts', () => {
    expect(
      messageText([text('a'), reasoning('r'), tool('list_stack', 'c1'), text('b')])
    ).toBe('ab')
  })

  it('is empty when there is no text', () => {
    expect(messageText([tool('list_stack', 'c1')])).toBe('')
  })
})

describe('lastTextIndex', () => {
  const act: RenderItem = { kind: 'activity', parts: [] }
  it('is -1 without text items', () => {
    expect(lastTextIndex([])).toBe(-1)
    expect(lastTextIndex([act])).toBe(-1)
  })

  it('finds the last text item, even an empty one', () => {
    expect(
      lastTextIndex([{ kind: 'text', text: 'a' }, act, { kind: 'text', text: '' }, act])
    ).toBe(2)
  })
})

describe('tailIsStreamingText', () => {
  it('is false without items', () => {
    expect(tailIsStreamingText([])).toBe(false)
  })

  it('is true when the last item is non-empty text', () => {
    expect(tailIsStreamingText([{ kind: 'text', text: 'hi' }])).toBe(true)
  })

  it('is false when the last item is empty text', () => {
    expect(tailIsStreamingText([{ kind: 'text', text: '' }])).toBe(false)
  })

  it('is false when a tool or interactive part trails earlier text', () => {
    const p = { toolCallId: 'c1', state: 'input-available', type: 'tool-ask_user' }
    expect(
      tailIsStreamingText([{ kind: 'text', text: 'hi' }, { kind: 'activity', parts: [p] }])
    ).toBe(false)
    expect(
      tailIsStreamingText([{ kind: 'text', text: 'hi' }, { kind: 'interactive', part: p }])
    ).toBe(false)
  })
})

describe('sourcePartsOf', () => {
  it('keeps source-url parts in order, duplicates included', () => {
    const s1 = source('https://a.example', 'A')
    const s2 = source('https://b.example')
    const s3 = source('https://a.example', 'A')
    expect(sourcePartsOf([text('x'), s1, tool('web_search', 'c1'), s2, s3])).toEqual([
      s1,
      s2,
      s3,
    ])
  })

  it('is empty without sources', () => {
    expect(sourcePartsOf([text('x')])).toEqual([])
  })
})

describe('attachmentsOf', () => {
  const base = { id: 'u1', role: 'user' as const, parts: [text('hi')] }

  it('reads metadata.attachments', () => {
    const atts = [{ filename: 'a.pdf', url: 'https://x/a.pdf' }]
    expect(attachmentsOf({ ...base, metadata: { attachments: atts } })).toBe(atts)
  })

  it('is empty without metadata or attachments', () => {
    expect(attachmentsOf(base)).toEqual([])
    expect(attachmentsOf({ ...base, metadata: {} })).toEqual([])
  })
})

describe('isImageAttachment', () => {
  it('needs a url', () => {
    expect(isImageAttachment({ filename: 'a.png', mediaType: 'image/png' })).toBe(false)
  })

  it('trusts mediaType when present', () => {
    expect(isImageAttachment({ filename: 'a.pdf', url: 'u', mediaType: 'image/jpeg' })).toBe(true)
    expect(isImageAttachment({ filename: 'a.png', url: 'u', mediaType: 'application/pdf' })).toBe(
      false
    )
  })

  it('falls back to the extension, case-insensitively', () => {
    for (const f of ['a.png', 'a.jpg', 'a.JPEG', 'a.webp', 'a.gif']) {
      expect(isImageAttachment({ filename: f, url: 'u' })).toBe(true)
    }
    expect(isImageAttachment({ filename: 'a.pdf', url: 'u' })).toBe(false)
    expect(isImageAttachment({ filename: 'a.png.pdf', url: 'u' })).toBe(false)
  })
})

describe('askUserAnswerText', () => {
  it('joins a multi-select answer', () => {
    expect(askUserAnswerText(['A', 'B'])).toBe('A, B')
  })

  it('stringifies a single answer', () => {
    expect(askUserAnswerText('Yes')).toBe('Yes')
  })

  it('renders a missing answer as empty', () => {
    expect(askUserAnswerText(undefined)).toBe('')
    expect(askUserAnswerText(null)).toBe('')
  })
})

describe('buildRenderItems — approval cards', () => {
  it('shows a gated tool as a card while it waits, and as a chip once it ran', () => {
    const waiting = { type: 'tool-delete_blood_test', toolCallId: 'c', state: 'approval-requested', approval: { id: 'a' } }
    const ran = { ...waiting, state: 'output-available', output: {} }
    expect(buildRenderItems([waiting])[0].kind).toBe('interactive')
    expect(buildRenderItems([ran])[0].kind).toBe('activity')
  })
})
