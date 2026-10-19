// How the insights chat turns a UIMessage's parts into what it renders: the
// interleaved text / tool-activity / interactive items of an assistant reply,
// its web-search sources, the plain text behind the copy button, and the
// attachment chips on a user message.
//
// Pure, no React — kept apart from the components so the rules are
// unit-testable (vitest runs in node without a DOM).

import type { UIMessage } from 'ai'

import type { SourcePart } from '@/components/insights/sources-footer'
import { INTERACTIVE_TOOLS } from './chat-continuation'

export type ToolPartLike = {
  toolCallId: string
  state: string
  name?: string
  /** Set on `dynamic-tool` parts, whose `type` does not carry the name. */
  toolName?: string
  type: string
  input?: unknown
  output?: unknown
}

export type RenderItem =
  | { kind: 'text'; text: string }
  | { kind: 'activity'; parts: ToolPartLike[] }
  | { kind: 'interactive'; part: ToolPartLike }

export interface AttachmentMeta {
  filename: string
  url?: string
  mediaType?: string
  storagePath?: string
}

export function toolNameOf(p: { name?: string; toolName?: string; type: string }): string {
  if (p.name) return p.name
  if (p.type === 'dynamic-tool' && p.toolName) return p.toolName
  return p.type.replace('tool-', '')
}

/**
 * Walk an assistant message's parts IN ORDER into render items, so reasoning
 * text, background tool activity, and interactive parts interleave the way they
 * streamed. Consecutive background (non-interactive) tool calls are grouped into
 * one collapsed activity block; consecutive text is merged.
 */
export function buildRenderItems(parts: readonly unknown[]): RenderItem[] {
  const items: RenderItem[] = []
  for (const raw of parts) {
    const part = raw as { type?: string; text?: string }
    const type = part.type ?? ''
    if (type === 'text') {
      const text = part.text ?? ''
      const last = items[items.length - 1]
      if (last && last.kind === 'text') last.text += text
      else items.push({ kind: 'text', text })
      continue
    }
    if (type === 'dynamic-tool' || type.startsWith('tool-')) {
      const tp = raw as ToolPartLike
      if (INTERACTIVE_TOOLS.includes(toolNameOf(tp))) {
        items.push({ kind: 'interactive', part: tp })
      } else {
        const last = items[items.length - 1]
        if (last && last.kind === 'activity') last.parts.push(tp)
        else items.push({ kind: 'activity', parts: [tp] })
      }
    }
    // other part types (step-start, reasoning, …) are ignored
  }
  return items
}

/** All of a message's `text` parts joined — what the copy button copies. */
export function messageText(parts: UIMessage['parts']): string {
  return parts
    .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

/** Index of the last text item (the one that gets the streaming caret), or -1. */
export function lastTextIndex(items: readonly RenderItem[]): number {
  return items.reduce(
    (acc, it, i) => (it.kind === 'text' ? i : acc),
    -1
  )
}

/**
 * The tail is visible streaming text when the last item is a non-empty text
 * part — its streaming caret covers the gap, so no indicator is needed.
 * Otherwise (no items, a trailing tool/interactive part, or an empty text
 * part) a streaming reply is mid-reasoning and needs the Thinking indicator.
 */
export function tailIsStreamingText(items: readonly RenderItem[]): boolean {
  const tailItem = items[items.length - 1]
  return tailItem?.kind === 'text' && !!tailItem.text
}

/**
 * Citations from Anthropic web_search — buildRenderItems silently ignores
 * `source-url` parts; the message renders them as a footer below the
 * interleaved content.
 */
export function sourcePartsOf(parts: UIMessage['parts']): SourcePart[] {
  return (parts as readonly unknown[]).filter(
    (p): p is SourcePart => (p as { type?: string }).type === 'source-url'
  )
}

/** The attachments a user message carries on its metadata (none → []). */
export function attachmentsOf(message: UIMessage): AttachmentMeta[] {
  return (
    ((message as { metadata?: { attachments?: AttachmentMeta[] } })
      .metadata?.attachments) ?? []
  )
}

/**
 * Whether an attachment chip opens the in-app image preview. Older persisted
 * messages may lack mediaType on metadata — fall back to the file extension so
 * their photos still get the preview dialog.
 */
export function isImageAttachment({
  filename,
  url,
  mediaType,
}: AttachmentMeta): boolean {
  return (
    !!url &&
    (mediaType ? mediaType.startsWith('image/') : /\.(png|jpe?g|webp|gif)$/i.test(filename))
  )
}

/** The answered note of an `ask_user` part: multi-select joins with commas. */
export function askUserAnswerText(output: unknown): string {
  return Array.isArray(output)
    ? (output as string[]).join(', ')
    : String(output ?? '')
}
