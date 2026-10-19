import type { UIMessage } from 'ai'

import type { ChatMessageRow } from '@/lib/database.types'

/** Map persisted chat rows to UIMessages for seeding a Chat on first open. */
export function toUIMessages(rows: ChatMessageRow[]): UIMessage[] {
  return rows
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      // Restore persisted tool parts (e.g. download-list cards) so they reappear
      // after a reload; text part comes last to match live order.
      const toolParts = Array.isArray(m.tool_invocations)
        ? (m.tool_invocations as UIMessage['parts'])
        : []
      const textPart = { type: 'text' as const, text: m.content }
      return {
        id: m.id,
        role: m.role as 'user' | 'assistant',
        // Carry persisted attachments onto metadata so the transcript's
        // attachment chips reappear after a thread switch/reload.
        metadata: m.attachments?.length ? { attachments: m.attachments } : undefined,
        parts:
          m.role === 'assistant' && toolParts.length > 0
            ? [...toolParts, textPart]
            : [textPart],
      } as UIMessage
    })
}
