import { describe, expect, it } from 'vitest'

import type { ChatAttachment, ChatMessageRow } from '@/lib/database.types'
import { toUIMessages } from '../to-ui-messages'

function row(overrides: Partial<ChatMessageRow> & Pick<ChatMessageRow, 'id' | 'role'>): ChatMessageRow {
  return {
    thread_id: 'thread-1',
    content: '',
    tool_invocations: null,
    attachments: null,
    created_at: '2026-10-17T12:00:00.000Z',
    ...overrides,
  }
}

const ATTACHMENT: ChatAttachment = {
  storagePath: 'user/a.png',
  mediaType: 'image/png',
  filename: 'a.png',
  url: 'https://signed.example/a.png',
}

describe('toUIMessages', () => {
  it('maps user and assistant rows to a single text part, in order', () => {
    const messages = toUIMessages([
      row({ id: 'm1', role: 'user', content: 'Hi' }),
      row({ id: 'm2', role: 'assistant', content: 'Hello' }),
    ])
    expect(messages).toEqual([
      { id: 'm1', role: 'user', metadata: undefined, parts: [{ type: 'text', text: 'Hi' }] },
      { id: 'm2', role: 'assistant', metadata: undefined, parts: [{ type: 'text', text: 'Hello' }] },
    ])
  })

  it('drops tool rows', () => {
    const messages = toUIMessages([
      row({ id: 'm1', role: 'user', content: 'Hi' }),
      row({ id: 't1', role: 'tool', content: '{}' }),
    ])
    expect(messages.map((m) => m.id)).toEqual(['m1'])
  })

  it('puts persisted tool parts before the text part on assistant rows', () => {
    const toolPart = { type: 'tool-ask_user', toolCallId: 'c1', state: 'output-available' }
    const [message] = toUIMessages([
      row({ id: 'm1', role: 'assistant', content: 'Done', tool_invocations: [toolPart] }),
    ])
    expect(message.parts).toEqual([toolPart, { type: 'text', text: 'Done' }])
  })

  it('ignores tool invocations on user rows', () => {
    const [message] = toUIMessages([
      row({ id: 'm1', role: 'user', content: 'Hi', tool_invocations: [{ type: 'tool-x' }] }),
    ])
    expect(message.parts).toEqual([{ type: 'text', text: 'Hi' }])
  })

  it('ignores tool invocations that are not an array or are empty', () => {
    const [a, b] = toUIMessages([
      row({ id: 'm1', role: 'assistant', content: 'A', tool_invocations: { type: 'tool-x' } }),
      row({ id: 'm2', role: 'assistant', content: 'B', tool_invocations: [] }),
    ])
    expect(a.parts).toEqual([{ type: 'text', text: 'A' }])
    expect(b.parts).toEqual([{ type: 'text', text: 'B' }])
  })

  it('carries attachments onto metadata, and leaves it undefined when there are none', () => {
    const [withFiles, emptyList] = toUIMessages([
      row({ id: 'm1', role: 'user', content: 'See file', attachments: [ATTACHMENT] }),
      row({ id: 'm2', role: 'user', content: 'No file', attachments: [] }),
    ])
    expect(withFiles.metadata).toEqual({ attachments: [ATTACHMENT] })
    expect(emptyList.metadata).toBeUndefined()
  })

  it('returns an empty list for no rows', () => {
    expect(toUIMessages([])).toEqual([])
  })
})
