'use client'

import { memo, useState } from 'react'
import { Check, Copy, RefreshCw } from 'lucide-react'
import type { UIMessage } from 'ai'

import { InterpretationContent } from '@/components/interpretation/interpretation-content'
import { ThinkingIndicator } from '@/components/ui/thinking-indicator'
import {
  buildRenderItems,
  lastTextIndex,
  messageText,
  sourcePartsOf,
  tailIsStreamingText,
} from '@/lib/insights/render-items'
import { ToolActivity } from './tool-activity'
import { SourcesFooter } from './sources-footer'
import { renderInteractivePart, type ToolAnswer } from './interactive-tool-part'

function MessageActions({
  text,
  isLastAssistant,
  onRetry,
}: {
  text: string
  isLastAssistant: boolean
  onRetry: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-1 flex items-center gap-1">
      <button
        type="button"
        onClick={handleCopy}
        className="rounded p-1 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
        title="Copy response"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
      {isLastAssistant && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded p-1 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
          title="Regenerate response"
        >
          <RefreshCw className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/**
 * One assistant message (interleaved text / tool activity / interactive parts).
 * Memoized: only the streaming message re-renders per token; completed messages
 * skip re-render (and the expensive markdown re-parse) entirely. `onToolAnswer`
 * and `onRetry` must stay referentially stable in the parent for memo to hold.
 * (AUT-898)
 */
export const AssistantMessage = memo(function AssistantMessage({
  message,
  streaming,
  isLastAssistant,
  onToolAnswer,
  onRetry,
}: {
  message: UIMessage
  streaming: boolean
  isLastAssistant: boolean
  onToolAnswer: (toolCallId: string, answer: ToolAnswer) => void
  onRetry: () => void
}) {
  const textContent = messageText(message.parts)

  const items = buildRenderItems(message.parts)
  const lastTextIdx = lastTextIndex(items)
  // See tailIsStreamingText: a non-empty trailing text part's caret covers the
  // gap; anything else while streaming needs the Thinking indicator.
  const tailIsText = tailIsStreamingText(items)

  // Citations from Anthropic web_search, rendered as a footer below the
  // interleaved content.
  const sources = sourcePartsOf(message.parts)

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        if (item.kind === 'activity') {
          return (
            <ToolActivity
              key={`a-${i}`}
              parts={item.parts}
              streaming={streaming}
            />
          )
        }
        if (item.kind === 'interactive') {
          return (
            <div key={item.part.toolCallId}>
              {renderInteractivePart(item.part, onToolAnswer)}
            </div>
          )
        }
        if (!item.text) return null
        return (
          <div key={`t-${i}`} className="max-w-[90%]">
            <InterpretationContent
              content={item.text}
              isStreaming={streaming && i === lastTextIdx}
            />
          </div>
        )
      })}
      {/* Fills the reasoning gap — pre-first-token OR after a mid-answer tool
          step (earlier text must not hide it). See tailIsStreamingText. */}
      {streaming && !tailIsText && <ThinkingIndicator />}
      <SourcesFooter sources={sources} />
      {!streaming && textContent && (
        <div className="max-w-[90%]">
          <MessageActions
            text={textContent}
            isLastAssistant={isLastAssistant}
            onRetry={onRetry}
          />
        </div>
      )}
    </div>
  )
})
