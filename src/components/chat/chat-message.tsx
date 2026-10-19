'use client'

import { cn } from '@/lib/utils'
import { InterpretationContent } from '@/components/interpretation/interpretation-content'
import { ThinkingIndicator } from '@/components/ui/thinking-indicator'
import type { ChatMessage } from '@/hooks/use-chat'

interface ChatMessageProps {
  message: ChatMessage
}

export function ChatMessageBubble({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className={cn(
            'max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2',
            'bg-primary text-primary-foreground'
          )}
        >
          <p className="text-sm leading-relaxed">{message.content}</p>
        </div>
      </div>
    )
  }

  // Assistant message: render as markdown. While it's streaming but hasn't
  // produced any text yet (adaptive thinking phase), show a thinking indicator
  // instead of an empty bubble with just a caret.
  const isThinking = !message.content && (message.isStreaming ?? false)
  return (
    <div className="flex justify-start">
      <div className="max-w-[95%]">
        {isThinking ? (
          <ThinkingIndicator />
        ) : (
          <InterpretationContent
            content={message.content}
            isStreaming={message.isStreaming ?? false}
          />
        )}
      </div>
    </div>
  )
}
