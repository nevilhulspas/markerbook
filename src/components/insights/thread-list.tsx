'use client'

import { useState } from 'react'
import { ChevronRight, Pencil, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ChatThread } from '@/lib/database.types'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { formatRelativeDate } from '@/lib/dates/relative'

interface ThreadListProps {
  threads: ChatThread[]
  activeThreadId: string | null
  /** Thread ids whose chat is currently generating — shows a pulsing dot. */
  generatingThreadIds?: Set<string>
  /** Thread ids that finished in the background and are unread — solid dot. */
  unreadThreadIds?: Set<string>
  onSwitch: (threadId: string) => void
  onDelete: (threadId: string) => void
  onRename: (threadId: string, title: string) => void
  /** Show at most this many rows; the rest are reached via the "All chats" footer. */
  limit?: number
  /** Rendered as an "All chats" footer when `limit` truncates the list. */
  onShowAll?: () => void
  /**
   * 'drawer' tightens row padding to px-2 so row text lines up with the mobile
   * drawer's group label and the New-conversation button above the list.
   */
  variant?: 'default' | 'drawer'
}

export function ThreadList({
  threads,
  activeThreadId,
  generatingThreadIds,
  unreadThreadIds,
  onSwitch,
  onDelete,
  onRename,
  limit,
  onShowAll,
  variant = 'default',
}: ThreadListProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  if (threads.length === 0) {
    return (
      <p className="p-4 text-center text-sm text-muted-foreground">
        No conversations yet
      </p>
    )
  }

  const shown = limit !== undefined ? threads.slice(0, limit) : threads
  const hasMore = limit !== undefined && threads.length > limit
  const rowPadding = variant === 'drawer' ? 'px-2' : 'px-3'

  function startRename(thread: ChatThread) {
    setRenamingId(thread.id)
    setDraft(thread.title)
  }

  function commitRename(threadId: string) {
    const trimmed = draft.trim()
    if (trimmed) onRename(threadId, trimmed)
    setRenamingId(null)
  }

  return (
    <div>
      {shown.map((thread) => {
        const isRenaming = renamingId === thread.id
        return (
          <ContextMenu key={thread.id}>
            <ContextMenuTrigger asChild>
              {isRenaming ? (
                <div className={cn('border-b py-2', rowPadding)}>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitRename(thread.id)
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        setRenamingId(null)
                      }
                    }}
                    onBlur={() => commitRename(thread.id)}
                    className="w-full rounded bg-background px-1.5 py-1 text-sm font-medium outline-none ring-1 ring-ring"
                    aria-label="Rename conversation"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onSwitch(thread.id)}
                  className={cn(
                    // select-none + touch-callout:none so a long-press opens our
                    // context menu on iOS instead of the native text callout.
                    'block w-full border-b py-2.5 text-left transition-colors select-none [-webkit-touch-callout:none] hover:bg-accent',
                    rowPadding,
                    thread.id === activeThreadId && 'bg-accent'
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {generatingThreadIds?.has(thread.id) ? (
                      <span
                        role="status"
                        aria-label="Generating"
                        title="Generating…"
                        className="size-2 shrink-0 animate-pulse rounded-full bg-primary"
                      />
                    ) : (
                      unreadThreadIds?.has(thread.id) && (
                        <span
                          role="status"
                          aria-label="Unread"
                          title="Unread reply"
                          className="size-2 shrink-0 rounded-full bg-primary"
                        />
                      )
                    )}
                    <p className="truncate text-sm font-medium">{thread.title}</p>
                  </div>
                  {/* The relative part ("Yesterday", "3d ago") counts from the
                      render time, which differs by a few seconds between the
                      server and the browser; around midnight the label can
                      flip in between. The calendar itself is pinned (see
                      formatRelativeDate). */}
                  <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                    {formatRelativeDate(thread.updated_at)}
                  </p>
                </button>
              )}
            </ContextMenuTrigger>
            {/* Prevent Radix restoring focus to the trigger on close, so the
                rename input's autoFocus wins. */}
            <ContextMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
              <ContextMenuItem onSelect={() => startRename(thread)}>
                <Pencil className="size-3.5" />
                Rename
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                onSelect={() => onDelete(thread.id)}
              >
                <Trash2 className="size-3.5" />
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )
      })}
      {hasMore && onShowAll && (
        <button
          type="button"
          onClick={onShowAll}
          className={cn(
            'flex w-full items-center justify-center gap-1 border-b py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            rowPadding
          )}
        >
          All chats
          <ChevronRight className="size-3.5" />
        </button>
      )}
    </div>
  )
}
