'use client'

import { useRef, useState, useSyncExternalStore } from 'react'

import { cn } from '@/lib/utils'
import type { ChatThread } from '@/lib/database.types'
import { ThreadList } from './thread-list'

interface ThreadSidebarProps {
  threads: ChatThread[]
  activeThreadId: string | null
  /** Thread ids whose chat is currently generating — shows a pulsing dot. */
  generatingThreadIds?: Set<string>
  /** Thread ids that finished in the background and are unread — solid dot. */
  unreadThreadIds?: Set<string>
  /** Slide the rail away together with the main nav sidebar. */
  collapsed?: boolean
  onSwitchThread: (threadId: string) => void
  onDeleteThread: (threadId: string) => void
  onRenameThread: (threadId: string, title: string) => void
}

const WIDTH_KEY = 'insights:sidebar-width'
const MIN_WIDTH = 200
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 256

function clampWidth(width: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))
}

// The persisted width only changes through this component, so there's nothing
// to subscribe to — useSyncExternalStore is used purely for its hydration
// semantics (server snapshot first, then a re-render with the client value).
const subscribeNoop = () => () => {}

function readStoredWidth() {
  const stored = Number(window.localStorage.getItem(WIDTH_KEY))
  return stored >= MIN_WIDTH && stored <= MAX_WIDTH ? stored : DEFAULT_WIDTH
}

export function ThreadSidebar({
  threads,
  activeThreadId,
  generatingThreadIds,
  unreadThreadIds,
  collapsed = false,
  onSwitchThread,
  onDeleteThread,
  onRenameThread,
}: ThreadSidebarProps) {
  // SSR renders the default width; right after hydration useSyncExternalStore
  // re-renders with the persisted width. Once the user resizes, the draft
  // (session state) takes over.
  const storedWidth = useSyncExternalStore(
    subscribeNoop,
    readStoredWidth,
    () => DEFAULT_WIDTH
  )
  const [draftWidth, setDraftWidth] = useState<number | null>(null)
  const width = draftWidth ?? storedWidth

  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ x: number; width: number } | null>(null)

  function persistWidth(next: number) {
    window.localStorage.setItem(WIDTH_KEY, String(next))
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStart.current = { x: e.clientX, width }
    setDragging(true)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return
    setDraftWidth(clampWidth(dragStart.current.width + e.clientX - dragStart.current.x))
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return
    const next = clampWidth(dragStart.current.width + e.clientX - dragStart.current.x)
    dragStart.current = null
    setDragging(false)
    persistWidth(next)
  }

  // The OS can cancel a drag mid-flight (system overlay, multi-finger
  // gesture); without this the handle stays highlighted and the width
  // transition stays disabled.
  function handlePointerCancel() {
    dragStart.current = null
    setDragging(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next = clampWidth(width + (e.key === 'ArrowRight' ? 16 : -16))
    setDraftWidth(next)
    persistWidth(next)
  }

  return (
    <div
      className={cn(
        'relative flex h-full shrink-0 flex-col overflow-hidden border-r',
        // Match the nav sidebar's collapse animation; no transition while
        // dragging so the rail tracks the cursor 1:1.
        !dragging && 'transition-[width] duration-200 ease-linear',
        collapsed && 'border-transparent'
      )}
      style={{ width: collapsed ? 0 : width }}
    >
      {/* Fixed inner width so collapsing clips the list instead of
          reflowing the text while it animates. */}
      <div className="scrollbar-subtle flex-1 overflow-y-auto" style={{ width }}>
        <ThreadList
          threads={threads}
          activeThreadId={activeThreadId}
          generatingThreadIds={generatingThreadIds}
          unreadThreadIds={unreadThreadIds}
          onSwitch={onSwitchThread}
          onDelete={onDeleteThread}
          onRename={onRenameThread}
        />
      </div>

      {/* Drag handle on the right edge. Pointer capture keeps the drag alive
          when the cursor outruns the 6px hit area; arrow keys resize for
          keyboard users. */}
      {!collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize conversation list"
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          aria-valuenow={width}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onKeyDown={handleKeyDown}
          className={cn(
            'absolute inset-y-0 -right-[3px] z-10 w-1.5 cursor-col-resize touch-none select-none transition-colors hover:bg-border focus-visible:bg-border focus-visible:outline-none',
            dragging && 'bg-border'
          )}
        />
      )}
    </div>
  )
}
