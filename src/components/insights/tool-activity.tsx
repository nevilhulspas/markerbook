'use client'

import { useState } from 'react'
import { ChevronRight, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { toolNameOf } from '@/lib/insights/render-items'
import { ToolInvocationDisplay } from './tool-invocation-display'

interface ToolPart {
  toolCallId: string
  state: string
  name?: string
  type: string
  // AI-SDK tool parts carry `input` alongside `output` so the chat can
  // describe what the tool was called with, not just that *something* ran.
  input?: unknown
  output?: unknown
}

// Mirror of the runningLabel() in tool-invocation-display.tsx but tailored
// to the *collapsed* header — short, no trailing ellipsis (that lives in
// the spinner row). Kept in-sync deliberately so we surface the same
// vocabulary in both spots.
function shortRunningLabel(part: ToolPart): string {
  const name = toolNameOf(part)
  const a = (part.input ?? {}) as Record<string, unknown>
  if (name === 'add_to_next_to_test') {
    const target =
      (typeof a.biomarkerName === 'string' && a.biomarkerName) ||
      (typeof a.testName === 'string' &&
        typeof a.labName === 'string' &&
        `${a.testName} (${a.labName})`) ||
      (typeof a.testName === 'string' && a.testName) ||
      null
    return target ? `Adding ${target}` : 'Adding to next-to-test'
  }
  if (name === 'add_many_to_next_to_test') {
    const items = Array.isArray(a.items) ? a.items : null
    return items
      ? `Adding ${items.length} test${items.length === 1 ? '' : 's'}`
      : 'Adding tests'
  }
  if (name === 'mark_next_to_test_done') return 'Marking entry done'
  if (name === 'remove_from_next_to_test') return 'Removing entry'
  if (name === 'list_next_to_test') return 'Reading next-to-test list'
  if (name === 'lookupMarkerHistory') {
    const m = typeof a.markerName === 'string' ? a.markerName : null
    return m ? `Looking up ${m} history` : 'Looking up marker history'
  }
  if (name === 'compareMarkers') return 'Comparing markers'
  if (name === 'lab_test_finder') {
    const b = typeof a.biomarker === 'string' ? a.biomarker : null
    return b ? `Looking up labs for ${b}` : 'Looking up lab tests'
  }
  if (name === 'list_lab_tests') return 'Listing lab catalogue'
  if (name === 'build_lab_test_lists') return 'Building lab test list'
  if (name === 'web_search') {
    const q = typeof a.query === 'string' ? a.query : null
    return q ? `Searching the web for "${q.slice(0, 40)}"` : 'Searching the web'
  }
  if (name === 'list_stack') return 'Reading your stack'
  if (name === 'add_supplement') {
    const n = typeof a.name === 'string' ? a.name : null
    return n ? `Adding ${n}` : 'Adding a supplement'
  }
  if (name === 'update_supplement') return 'Updating a supplement'
  if (name === 'remove_supplement') return 'Removing a supplement'
  if (name === 'list_wishlist') return 'Reading your wishlist'
  if (name === 'add_wishlist_item') {
    const n = typeof a.name === 'string' ? a.name : null
    return n ? `Adding ${n} to the wishlist` : 'Adding a wishlist item'
  }
  if (name === 'update_wishlist_item') return 'Updating a wishlist item'
  if (name === 'remove_wishlist_item') return 'Removing a wishlist item'
  if (name === 'add_wishlist_source') return 'Adding a buy-source'
  if (name === 'move_wishlist_to_stack') return 'Moving to your stack'
  return name
}

/**
 * Collapses background tool activity (lab lookups, memory, etc.) behind a
 * reasoning-style disclosure that is collapsed by default, so the transcript
 * shows the answer and interactive parts — not raw tool JSON. While any tool is
 * still running the header shows a spinner with a tool-specific label so the
 * user knows *what* is happening (not just "Looking things up…"). Expanding
 * reveals the per-tool displays. Interactive tools (ask_user,
 * build_lab_test_lists) are rendered by the caller and never passed here.
 */
export function ToolActivity({
  parts,
  streaming,
}: {
  parts: unknown[]
  /**
   * Whether the message this activity belongs to is still being generated.
   * Without it a tool part that never reaches `output-available` — a turn cut
   * short by the step cap, an aborted run — leaves the header spinning forever
   * on a reply that visibly finished.
   */
  streaming: boolean
}) {
  const [open, setOpen] = useState(false)

  const typed = parts as ToolPart[]
  if (typed.length === 0) return null

  const runningPart = streaming
    ? typed.find(
        (p) => p.state === 'input-streaming' || p.state === 'input-available'
      )
    : undefined
  const label = runningPart
    ? `${shortRunningLabel(runningPart)}…`
    : `Tool activity · ${typed.length} step${typed.length === 1 ? '' : 's'}`

  return (
    <div className="rounded-lg border bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={open}
      >
        {runningPart ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <ChevronRight
            className={cn('size-3 transition-transform', open && 'rotate-90')}
          />
        )}
        <span>{label}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t px-3 py-2">
          {typed.map((p) => (
            <ToolInvocationDisplay
              key={p.toolCallId}
              toolName={toolNameOf(p)}
              state={p.state}
              input={p.input}
              output={p.output}
            />
          ))}
        </div>
      )}
    </div>
  )
}
