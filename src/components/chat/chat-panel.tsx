'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { SendHorizontal, Square } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ChatMessage } from '@/hooks/use-chat'
import { ChatMessageBubble } from './chat-message'

interface ChatPanelProps {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  onSendMessage: (text: string) => void
  onAbort: () => void
}

export function ChatPanel({
  messages,
  isStreaming,
  error,
  onSendMessage,
  onAbort,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive or content changes
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    onSendMessage(trimmed)
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Only show follow-up messages (skip the initial interpretation which is index 0)
  const chatMessages = messages.filter((m) => m.id !== 'initial-interpretation')

  return (
    <div className="flex flex-col gap-3">
      {/* Divider label */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground">
          Ask a follow-up
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Message list */}
      {chatMessages.length > 0 && (
        <div
          ref={scrollRef}
          className="flex max-h-[400px] flex-col gap-4 overflow-y-auto"
        >
          {chatMessages.map((message) => (
            <ChatMessageBubble key={message.id} message={message} />
          ))}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a follow-up question..."
          disabled={isStreaming}
          className="flex-1"
        />
        {isStreaming ? (
          <Button
            size="icon"
            variant="outline"
            onClick={onAbort}
            className="shrink-0"
          >
            <Square className="size-4" />
            <span className="sr-only">Stop</span>
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim()}
            className={cn('shrink-0', !input.trim() && 'opacity-50')}
          >
            <SendHorizontal className="size-4" />
            <span className="sr-only">Send</span>
          </Button>
        )}
      </div>
    </div>
  )
}
