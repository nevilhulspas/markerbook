'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import type { ChatThread } from '@/lib/database.types'
import { deleteThread, updateThreadTitle } from '@/actions/chat-threads'
import { ThreadList } from './thread-list'

/**
 * Full conversation list for the dedicated "All chats" page. Reuses ThreadList
 * (same rows, same right-click / long-press menu). Tapping a row opens it in the
 * chat via /insights?thread=… (the insights page reads that and switches to it).
 */
export function ChatsList({ threads: initial }: { threads: ChatThread[] }) {
  const router = useRouter()
  const [threads, setThreads] = useState(initial)

  return (
    <div className="overflow-hidden rounded-lg border">
      <ThreadList
        threads={threads}
        activeThreadId={null}
        onSwitch={(id) => router.push(`/insights?thread=${id}`)}
        onDelete={async (id) => {
          const snapshot = threads
          setThreads((prev) => prev.filter((t) => t.id !== id))
          const { error } = await deleteThread(id)
          if (error) setThreads(snapshot) // revert on failure
        }}
        onRename={async (id, title) => {
          const snapshot = threads
          setThreads((prev) =>
            prev.map((t) => (t.id === id ? { ...t, title } : t))
          )
          const { error } = await updateThreadTitle(id, title)
          if (error) setThreads(snapshot) // revert on failure
        }}
      />
    </div>
  )
}
