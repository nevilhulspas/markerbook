'use client'

import { useState } from 'react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import { RefreshCw, Square, XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { InterpretationContent } from './interpretation-content'
import { InterpretationSkeleton } from './interpretation-skeleton'
import { ThinkingIndicator } from '@/components/ui/thinking-indicator'
import {
  CompactDisclaimer,
  FullDisclaimer,
  useDisclaimerSeen,
} from './medical-disclaimer'
import { ChatPanel } from '@/components/chat/chat-panel'
import type { ChatMessage } from '@/hooks/use-chat'

interface InterpretationPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  content: string
  isStreaming: boolean
  isLoading: boolean
  error: string | null
  cachedAt: string | null
  isStale: boolean
  onRegenerate: () => void
  onAbort: () => void
  chatMessages?: ChatMessage[]
  isChatStreaming?: boolean
  chatError?: string | null
  onSendChatMessage?: (text: string) => void
  onAbortChat?: () => void
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHrs = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHrs / 24)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  return `${diffDays}d ago`
}

export function InterpretationPanel({
  open,
  onOpenChange,
  title,
  subtitle,
  content,
  isStreaming,
  isLoading,
  error,
  cachedAt,
  isStale,
  onRegenerate,
  onAbort,
  chatMessages,
  isChatStreaming,
  chatError,
  onSendChatMessage,
  onAbortChat,
}: InterpretationPanelProps) {
  const disclaimerSeen = useDisclaimerSeen()
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false)
  const showFullDisclaimer =
    !disclaimerSeen && !disclaimerDismissed && (content || isStreaming)

  return (
    <SheetPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l bg-background shadow-lg transition ease-in-out sm:max-w-lg',
            'data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=closed]:slide-out-to-right',
            'data-[state=open]:animate-in data-[state=open]:duration-500 data-[state=open]:slide-in-from-right'
          )}
        >
          {/* Header */}
          <div className="flex flex-col gap-1.5 border-b p-4 pr-12">
            <SheetPrimitive.Title className="font-semibold text-foreground">
              {title}
            </SheetPrimitive.Title>
            {subtitle && (
              <SheetPrimitive.Description className="text-sm text-muted-foreground">
                {subtitle}
              </SheetPrimitive.Description>
            )}
          </div>

          {/* Close button */}
          <SheetPrimitive.Close className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Full disclaimer for first-time users */}
            {showFullDisclaimer && (
              <div className="mb-4">
                <FullDisclaimer
                  onDismiss={() => setDisclaimerDismissed(true)}
                />
              </div>
            )}

            {/* Stale cache banner */}
            {isStale && !isStreaming && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                <p className="flex-1 text-sm text-amber-700 dark:text-amber-300">
                  Your profile or markers have changed since this
                  interpretation.
                </p>
                <Button size="sm" variant="outline" onClick={onRegenerate}>
                  <RefreshCw className="size-3" />
                  Regenerate
                </Button>
              </div>
            )}

            {/* Cached badge */}
            {cachedAt && !isStale && !isStreaming && (
              <div className="mb-4 flex items-center gap-2">
                <Badge variant="secondary">
                  Cached {formatRelativeTime(cachedAt)}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-auto px-2 py-1 text-xs"
                  onClick={onRegenerate}
                >
                  <RefreshCw className="size-3" />
                  Regenerate
                </Button>
              </div>
            )}

            {/* Loading skeleton (cache-check phase) */}
            {isLoading && !content && <InterpretationSkeleton />}

            {/* Reasoning gap: streaming has begun but adaptive thinking hasn't
                emitted any answer text yet — fill the silence. */}
            {isStreaming && !content && <ThinkingIndicator />}

            {/* Error state */}
            {error && (
              <div className="space-y-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm text-destructive">{error}</p>
                <Button size="sm" variant="outline" onClick={onRegenerate}>
                  Try again
                </Button>
              </div>
            )}

            {/* Interpretation content */}
            {content && (
              <InterpretationContent
                content={content}
                isStreaming={isStreaming}
              />
            )}

            {/* Chat follow-up section */}
            {content && !isLoading && !isStreaming && onSendChatMessage && onAbortChat && (
              <div className="mt-6">
                <ChatPanel
                  messages={chatMessages ?? []}
                  isStreaming={isChatStreaming ?? false}
                  error={chatError ?? null}
                  onSendMessage={onSendChatMessage}
                  onAbort={onAbortChat}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t p-4">
            <CompactDisclaimer />
            {isStreaming && (
              <Button size="sm" variant="outline" onClick={onAbort}>
                <Square className="size-3" />
                Stop
              </Button>
            )}
          </div>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  )
}
