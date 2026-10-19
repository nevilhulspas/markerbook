'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { useChat, Chat } from '@ai-sdk/react'
import {
  DefaultChatTransport,
  type UIMessage,
} from 'ai'

import {
  hasUnansweredInteractiveTool,
  lastAssistantMessageAwaitsInteractiveTool,
} from '@/lib/insights/chat-continuation'
import {
  answerIsRecoverable,
  answerMayStillArrive,
  isConnectionFailure,
  threadTailOf,
  RECOVERY_ANSWER_WINDOW_MS,
  RECOVERY_POLL_INTERVAL_MS,
  type ThreadTail,
} from '@/lib/insights/thread-recovery'
import {
  clearUnread,
  markUnread,
  parseIds,
  persistGenerating,
  readUnreadRaw,
  reconcileUnread,
  subscribeUnread,
} from '@/lib/insights/unread-store'
import { toUIMessages } from '@/lib/insights/to-ui-messages'

import type { ChatAttachment, ChatThread, SnpVariant } from '@/lib/database.types'
import type { HealthScores } from '@/lib/insights/health-scores'
import type {
  DutchContext,
  MicrobiomeTestContext,
  OtherTestContext,
  RmrContext,
} from '@/lib/insights/insights-chat-prompt'
import type {
  MarkerHistoryEntry,
  ProfileContext,
  SupplementContext,
} from '@/lib/interpretation/types'
import {
  createThread,
  deleteThread,
  getThreadMessages,
  getThreadTail,
  updateThreadTitle,
} from '@/actions/chat-threads'
import { deleteChatAttachment, uploadChatAttachment } from '@/actions/chat-attachments'
import { prepareImageForUpload } from '@/lib/insights/image-tiles'
import { getInsightsContextPreview } from '@/actions/insights-context'
import { MessageSquarePlus } from 'lucide-react'

import { useIsMobile } from '@/hooks/use-mobile'
import { useSidebar } from '@/components/ui/sidebar'
import { useSidebarExtra } from '@/components/layout/sidebar-extra-context'
import { Button } from '@/components/ui/button'
import { ThreadList } from './thread-list'
import { ThreadSidebar } from './thread-sidebar'
import { InsightsChat } from './insights-chat'

interface InsightsClientProps {
  threads: ChatThread[]
  markerHistory: MarkerHistoryEntry[]
  profile: ProfileContext
  supplements: SupplementContext[]
  healthScores: HealthScores
  geneticSnps: SnpVariant[]
  dutchContext: DutchContext | null
  microbiomeTests: MicrobiomeTestContext[]
  otherTests: OtherTestContext[]
  rmrContext: RmrContext | null
  isAdmin: boolean
  /** When set (e.g. from /insights?thread=…), open this thread on mount. */
  initialThreadId?: string | null
}

export function InsightsClient({
  threads: initialThreads,
  markerHistory,
  profile,
  supplements,
  healthScores,
  geneticSnps,
  dutchContext,
  microbiomeTests,
  otherTests,
  rmrContext,
  isAdmin,
  initialThreadId,
}: InsightsClientProps) {
  const [threads, setThreads] = useState(initialThreads)
  // Start with no thread selected so the page always opens on a fresh
  // session (the starter prompts). The thread row is created lazily on the
  // first submit — see handleSend.
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  // Always-current mirror of activeThreadId. useChat keeps its INITIAL transport
  // for the page's lifetime (keyed by id), so a transport memoized on
  // activeThreadId would go stale — automatic tool-result continuations (which
  // carry no per-message body) would then post the wrong/empty threadId and the
  // route would 404 "Thread not found". The transport reads this ref at request
  // time instead. Kept in sync wherever activeThreadId is set.
  const threadIdRef = useRef<string | null>(null)

  // Monotonic "thread-change intent" counter. Every switch / new-thread / delete
  // captures the next value and, after its async work (getThreadMessages or
  // createThread), applies its result ONLY if it's still the latest intent. This
  // covers the cases threadIdRef alone can't: handleNewThread / handleSend can't
  // pre-set threadIdRef (the new id isn't known until the server responds), so a
  // late createThread must not hijack a switch the user made in the meantime.
  const threadOpRef = useRef(0)

  // Per-thread Chat instances (OTH-21). The page shows ONE thread at a time, but
  // a thread's response must keep streaming after the user switches away. Each
  // thread gets its own AI-SDK Chat — which owns the stream lifecycle (fetch +
  // job executor) independent of the React hook — so background threads keep
  // generating; the hook just binds to whichever thread is active. Instances
  // live for the page's lifetime in this map (bounded by threads opened).
  const chatsRef = useRef(new Map<string, Chat<UIMessage>>())

  // Status-callback unsubscribers, keyed by thread id, so deleting a thread also
  // tears down its sidebar-dot subscription (not just the Chat instance).
  const chatUnsubsRef = useRef(new Map<string, () => void>())

  // Thread ids whose Chat is currently generating — drives the pulsing dot.
  const [generatingThreadIds, setGeneratingThreadIds] = useState<Set<string>>(new Set())
  // Same set as a ref, so a status callback can read the PREVIOUS generating
  // state synchronously (state closures would be stale) to detect done-transitions.
  const generatingRef = useRef(new Set<string>())

  // Threads whose answer is being waited for in the database because their
  // stream died (OTH-40). Shown exactly like generating — the reply really is
  // still on its way — and cancelled by the composer's stop button.
  const [recoveringThreadIds, setRecoveringThreadIds] = useState<Set<string>>(new Set())
  /** Cancel flags for the polls in flight, keyed by thread id. */
  const recoveryRef = useRef(new Map<string, { cancelled: boolean }>())

  /** Threads that owe the user an answer — live stream or waited-for reply. */
  const busyThreadIds = useMemo(
    () => new Set([...generatingThreadIds, ...recoveringThreadIds]),
    [generatingThreadIds, recoveringThreadIds]
  )

  /** Drop a thread from the "waiting" set, and with it the busy indicator. */
  const clearRecovering = useCallback((threadId: string) => {
    setRecoveringThreadIds((prev) => {
      if (!prev.has(threadId)) return prev
      const next = new Set(prev)
      next.delete(threadId)
      return next
    })
  }, [])

  /**
   * Stop waiting for a thread's answer. The entry is REMOVED, not just flagged:
   * leaving it behind would make the re-entry guard below reject the next
   * recovery until this loop happens to wake up — so a second dropped stream on
   * the same thread would never be recovered.
   */
  const stopRecovery = useCallback(
    (threadId: string) => {
      const token = recoveryRef.current.get(threadId)
      if (!token) return
      token.cancelled = true
      recoveryRef.current.delete(threadId)
      clearRecovering(threadId)
    },
    [clearRecovering]
  )

  /**
   * Wait for a dropped answer to land in the database, then put it on screen.
   *
   * Two callers, and they know different things. A failed live stream KNOWS a
   * run was in flight, so it waits out loud (`showBusy`) — thinking indicator,
   * stop button. Reopening a thread only knows the last stored message is the
   * user's, which also describes a turn that died server-side; that wait is
   * silent, because promising an answer we cannot know is coming is worse than
   * saying nothing. Either way the reply appears by itself when it lands.
   */
  const recoverThread = useCallback(
    async (threadId: string, { showBusy = false }: { showBusy?: boolean } = {}) => {
      const instance = chatsRef.current.get(threadId)
      // A poll for this thread is already running, or the thread is gone.
      if (!instance || recoveryRef.current.has(threadId)) return

      const token = { cancelled: false }
      recoveryRef.current.set(threadId, token)
      if (showBusy) setRecoveringThreadIds((prev) => new Set(prev).add(threadId))

      // Second bound, for when the polls themselves fail: without rows we
      // cannot read the turn's age, so nothing else would end the loop.
      const deadline = Date.now() + RECOVERY_ANSWER_WINDOW_MS
      try {
        for (;;) {
          // One narrow query per check — the newest message's role and time,
          // nothing else (see getThreadTail). A failed poll is expected here,
          // the connection having just broken, so keep waiting rather than
          // letting the rejection end the whole recovery (and escape as an
          // unhandled rejection to the caller's `void`).
          let tail: ThreadTail | null = null
          try {
            tail = (await getThreadTail(threadId)).data
          } catch (error) {
            console.warn('[insights-chat] recovery poll failed, still waiting', error)
          }

          // Give up quietly whenever the thread stops being ours to fill in:
          // the user pressed stop, deleted it, or started a new turn (whose
          // own stream now owns the transcript).
          if (token.cancelled) return
          const live = chatsRef.current.get(threadId)
          if (live !== instance) return
          if (live.status === 'streaming' || live.status === 'submitted') return

          // A card the user has not clicked yet outranks anything stored: it
          // is never persisted in that state, so swapping the transcript in
          // would take its buttons away and strand the turn.
          if (hasUnansweredInteractiveTool(live.messages)) return

          if (tail && answerIsRecoverable(tail, live.messages.length)) {
            // The reply landed: now — and only now — load the transcript in
            // full, with its tool cards and attachment links.
            const restored = (await getThreadMessages(threadId)).data
            if (token.cancelled || chatsRef.current.get(threadId) !== instance) return
            if (restored) {
              live.messages = toUIMessages(restored)
              live.clearError() // drops the "Load failed" the drop left behind
              if (threadId !== threadIdRef.current) markUnread(threadId)
            }
            return
          }
          // Nothing yet — and nothing coming, once the turn is too old to be
          // live. A thread that no longer expects an answer (the request never
          // reached the server) ends the wait here too.
          if (tail && !answerMayStillArrive(tail, Date.now())) return
          if (Date.now() >= deadline) return
          await new Promise((resolve) => setTimeout(resolve, RECOVERY_POLL_INTERVAL_MS))
          if (token.cancelled) return
        }
      } finally {
        // Only tidy up if this loop is still the thread's current recovery —
        // stopRecovery may already have handed the slot to a newer one.
        if (recoveryRef.current.get(threadId) === token) {
          recoveryRef.current.delete(threadId)
          clearRecovering(threadId)
        }
      }
    },
    [clearRecovering]
  )

  // Leaving the page ends every wait. Otherwise a poll keeps hitting the server
  // every few seconds for minutes after the chat is gone, and a remount would
  // start a second loop for the same thread.
  useEffect(() => {
    const tokens = recoveryRef.current
    return () => {
      tokens.forEach((token) => {
        token.cancelled = true
      })
      tokens.clear()
    }
  }, [])

  // Thread ids that finished generating in the background (while the user was on
  // another thread) and haven't been opened since — drives the solid "unread"
  // dot. Backed by localStorage via useSyncExternalStore so the dot survives a
  // page refresh; SSR snapshot is empty, the client value hydrates in after.
  const unreadRaw = useSyncExternalStore(subscribeUnread, readUnreadRaw, () => '[]')
  const unreadThreadIds = useMemo(() => parseIds(unreadRaw), [unreadRaw])

  // One-time reconciliation after a refresh: threads that were still GENERATING
  // when the page unloaded become unread (their stream died with the page, so
  // the reply was never seen), and ids for threads deleted elsewhere are pruned.
  useEffect(() => {
    reconcileUnread(new Set(initialThreads.map((t) => t.id)))
    // Mount-only: initialThreads is the server snapshot for this page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist the generating set so the reconciliation above can see, after a
  // refresh, which threads were mid-stream when the page went away. The ACTIVE
  // thread is excluded: the user is watching it stream, so a refresh shouldn't
  // resurrect it as "unread" — only background threads earn the dot.
  useEffect(() => {
    persistGenerating([...busyThreadIds].filter((id) => id !== activeThreadId))
  }, [busyThreadIds, activeThreadId])

  const contextBody = useMemo(
    () => ({ markerHistory, profile, supplements, healthScores, geneticSnps, dutchContext, microbiomeTests, otherTests, rmrContext }),
    [markerHistory, profile, supplements, healthScores, geneticSnps, dutchContext, microbiomeTests, otherTests, rmrContext]
  )

  // A transport bound to ONE thread id, so every request (including automatic
  // tool-result continuations that carry no per-message body) persists to the
  // right thread — even while it streams in the background.
  const makeTransport = useCallback(
    (threadId: string) =>
      new DefaultChatTransport({
        api: '/api/insights-chat',
        body: contextBody,
        prepareSendMessagesRequest({ body, messages }) {
          return { body: { ...body, messages, threadId } }
        },
      }),
    [contextBody]
  )

  // Get-or-create the Chat for a thread. Existing (possibly still-streaming)
  // instances are reused so switching back shows live state; new ones are seeded
  // with the persisted messages loaded from the DB. sendAutomaticallyWhen only
  // resumes on a completed interactive tool (ask_user) — the OTH-18 predicate.
  const ensureChat = useCallback(
    (threadId: string, initialMessages: UIMessage[] = []): Chat<UIMessage> => {
      const existing = chatsRef.current.get(threadId)
      if (existing) return existing
      const instance = new Chat<UIMessage>({
        id: threadId,
        messages: initialMessages,
        transport: makeTransport(threadId),
        sendAutomaticallyWhen: lastAssistantMessageAwaitsInteractiveTool,
        onError: (error) => {
          console.error('[insights-chat] stream error:', error)
          // The connection dropped, not the server complaining — the answer is
          // still being written and will be saved. Wait for it instead of
          // leaving the user with a raw "Load failed" (OTH-40).
          if (isConnectionFailure(error)) void recoverThread(threadId, { showBusy: true })
        },
      })
      chatsRef.current.set(threadId, instance)
      // Mirror this thread's generating state into the sidebar-dot set.
      // registerStatusCallback is the same subscription the SDK's useChat uses;
      // it returns an unsubscribe we keep so delete can tear the callback down.
      const unsubscribe = instance['~registerStatusCallback'](() => {
        const generating = instance.status === 'streaming' || instance.status === 'submitted'
        const wasGenerating = generatingRef.current.has(threadId)
        if (generating) generatingRef.current.add(threadId)
        else generatingRef.current.delete(threadId)
        setGeneratingThreadIds((prev) => {
          if (generating === prev.has(threadId)) return prev
          const next = new Set(prev)
          if (generating) next.add(threadId)
          else next.delete(threadId)
          return next
        })
        // A background thread that just went from generating → done becomes
        // "unread" until the user opens it. threadIdRef mirrors the active thread.
        if (!generating && wasGenerating && threadId !== threadIdRef.current) {
          markUnread(threadId)
        }
      })
      chatUnsubsRef.current.set(threadId, unsubscribe)
      return instance
    },
    [makeTransport, recoverThread]
  )

  // Stable placeholder Chat for the starter screen (no thread selected yet). It
  // never sends — the first send creates a thread and targets that thread's Chat.
  // A lazy useState initializer constructs it exactly once for the page's life.
  const [placeholderChat] = useState(
    () => new Chat<UIMessage>({ id: 'insights-placeholder', messages: [], transport: makeTransport('') })
  )

  // The Chat the hook is bound to. It's state (not derived in render) so the
  // thread handlers can create/look up the instance in an event handler — never
  // touching the chat-map ref during render — and rebind the hook by setting it.
  const [activeChat, setActiveChat] = useState<Chat<UIMessage>>(placeholderChat)
  const chat = useChat({ chat: activeChat })

  const isMobile = useIsMobile()
  const router = useRouter()
  const { setOpenMobile, state: sidebarState } = useSidebar()
  const { setExtra } = useSidebarExtra()

  // Upload one composer file to storage. Runs as soon as the file is attached
  // (paste/drop/picker — see InsightsChat), not on send, so the upload is
  // usually done by the time the user finishes typing. Images are resized
  // (normal photos) or split into ~1 MP page tiles (long documents like
  // receipts) so every piece stays within Anthropic's per-image limits AND
  // legible; a tiled image becomes one attachment with several `parts`.
  const uploadAttachment = useCallback(async (file: File): Promise<ChatAttachment | null> => {
    let blobs: Blob[]
    try {
      blobs = await prepareImageForUpload(file)
    } catch {
      blobs = [file] // fall back to the original if resize/tiling fails
    }
    const results = await Promise.all(
      blobs.map((blob) => {
        const fd = new FormData()
        fd.append('file', new File([blob], file.name, { type: blob.type || file.type }))
        return uploadChatAttachment(fd)
      })
    )
    const ok = results.filter((r): r is Extract<typeof r, { success: true }> => r.success)
    if (ok.length === 0) return null
    const paths = ok.map((r) => r.storagePath)
    return {
      storagePath: paths[0],
      parts: paths.length > 1 ? paths : undefined,
      mediaType: ok[0].mediaType,
      filename: file.name,
      url: ok[0].signedUrl,
    }
  }, [])

  // Clean up storage when the user discards an attachment before sending.
  // Fire-and-forget — a failed delete just leaves an unreferenced file behind.
  const removeUpload = useCallback((storagePaths: string[]) => {
    void deleteChatAttachment(storagePaths)
  }, [])

  // Send a message on a SPECIFIC thread's Chat (not necessarily the active one),
  // so a fresh thread's first message goes to its own instance even before the
  // hook re-binds. The per-thread transport carries the threadId; attachments
  // ride the per-send body (the server injects their bytes from storage).
  const sendOn = useCallback(
    (instance: Chat<UIMessage>, text: string, attachments?: ChatAttachment[]) => {
      // A new question supersedes any wait for the previous answer — this
      // stream now owns the transcript.
      stopRecovery(instance.id)
      // Auto-title: a thread's first message names its sidebar row. Keyed on the
      // instance's own id + empty message list, so it fires whether the thread
      // was created lazily on send OR up-front via the "New conversation" button.
      if (instance.messages.length === 0 && text) {
        const title = text.length > 60 ? text.slice(0, 57) + '...' : text
        setThreads((prev) => prev.map((t) => (t.id === instance.id ? { ...t, title } : t)))
      }
      const atts = attachments ?? []
      void instance.sendMessage(
        { text, metadata: atts.length > 0 ? { attachments: atts } : undefined },
        { body: { attachments: atts.length > 0 ? atts : undefined } }
      )
    },
    [stopRecovery]
  )

  const handleNewThread = useCallback(async () => {
    // No chat.stop() — other threads keep streaming in the background (OTH-21).
    const gen = ++threadOpRef.current
    const result = await createThread()
    // A newer switch/new-thread happened while creating — don't hijack it.
    if (threadOpRef.current !== gen) return
    if (result.data) {
      setThreads((prev) => [result.data!, ...prev])
      threadIdRef.current = result.data.id
      const instance = ensureChat(result.data.id, [])
      setActiveThreadId(result.data.id)
      setActiveChat(instance)
    }
  }, [ensureChat])

  const handleSwitchThread = useCallback(
    async (threadId: string) => {
      if (threadId === activeThreadId) return
      const gen = ++threadOpRef.current
      threadIdRef.current = threadId
      // Opening a thread clears its unread dot.
      clearUnread(threadId)

      // A live Chat already exists (maybe still streaming) — just bind to it; its
      // stream and messages are preserved. No stop, no reload.
      const existing = chatsRef.current.get(threadId)
      if (existing) {
        setActiveThreadId(threadId)
        setActiveChat(existing)
        // Its stream may have died while the user was elsewhere, and the reply
        // saved since. Check quietly instead of leaving the thread stale until
        // a page reload; a thread that is still streaming is left alone.
        if (existing.status !== 'streaming' && existing.status !== 'submitted') {
          void recoverThread(threadId)
        }
        return
      }

      // First open this session: load persisted messages and seed the Chat.
      const result = await getThreadMessages(threadId)
      // Guard against a stale load: bail if a newer thread-change intent happened.
      if (threadOpRef.current !== gen) return
      const instance = ensureChat(threadId, result.data ? toUIMessages(result.data) : [])
      setActiveThreadId(threadId)
      setActiveChat(instance)

      // The last thing stored is the question, recently. Most likely this
      // thread was left (or the page reloaded) while its answer was still
      // being written, and the run carries on server-side — so watch for the
      // reply and drop it in when it lands. Silently, though: a turn that died
      // server-side looks exactly the same from here, and a thinking indicator
      // promising an answer that never comes is worse than no promise.
      if (result.data && answerMayStillArrive(threadTailOf(result.data), Date.now())) {
        void recoverThread(threadId)
      }
    },
    [activeThreadId, ensureChat, recoverThread]
  )

  const handleDeleteThread = useCallback(
    async (threadId: string) => {
      const result = await deleteThread(threadId)
      if (!result.error) {
        // The thread is gone — stop its Chat, tear down its status subscription,
        // and drop both from their pools.
        const instance = chatsRef.current.get(threadId)
        if (instance) {
          instance.stop()
          chatsRef.current.delete(threadId)
        }
        stopRecovery(threadId)
        chatUnsubsRef.current.get(threadId)?.()
        chatUnsubsRef.current.delete(threadId)
        generatingRef.current.delete(threadId)
        setGeneratingThreadIds((prev) => {
          if (!prev.has(threadId)) return prev
          const next = new Set(prev)
          next.delete(threadId)
          return next
        })
        clearUnread(threadId)
        setThreads((prev) => prev.filter((t) => t.id !== threadId))
        if (threadId === activeThreadId) {
          const remaining = threads.filter((t) => t.id !== threadId)
          if (remaining.length > 0) {
            handleSwitchThread(remaining[0].id)
          } else {
            ++threadOpRef.current // invalidate any in-flight switch/create load.
            threadIdRef.current = null
            setActiveThreadId(null)
            setActiveChat(placeholderChat)
          }
        }
      }
    },
    [activeThreadId, threads, handleSwitchThread, placeholderChat, stopRecovery]
  )

  // Optimistically rename a thread, then persist. RLS scopes the update to the
  // current user (see updateThreadTitle).
  const handleRenameThread = useCallback(
    async (threadId: string, title: string) => {
      const trimmed = title.trim()
      if (!trimmed) return
      const snapshot = threads
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, title: trimmed } : t))
      )
      const { error } = await updateThreadTitle(threadId, trimmed)
      if (error) setThreads(snapshot) // revert on failure
    },
    [threads]
  )

  // Keep the latest drawer handlers in a ref. `useChat` returns a fresh `chat`
  // object every render, which changes the identity of these useCallback
  // handlers every render. If the drawer-slot effect below depended on them
  // directly, it would re-run every render — and on mobile each run calls
  // setExtra() with a brand-new node, triggering an infinite update loop.
  // The pushed node reads handlers from this ref at click time instead, so the
  // effect can depend only on the actual conversation data.
  const drawerActionsRef = useRef({
    handleNewThread,
    handleSwitchThread,
    handleDeleteThread,
    handleRenameThread,
    setOpenMobile,
  })
  useEffect(() => {
    drawerActionsRef.current = {
      handleNewThread,
      handleSwitchThread,
      handleDeleteThread,
      handleRenameThread,
      setOpenMobile,
    }
  })

  // On mobile the conversation list lives inside the shared swipe drawer (under
  // the nav) instead of an inline rail. Push a ThreadList node into the sidebar
  // slot whenever the conversation data changes; the node's callbacks read the
  // current handlers from the ref above. Cleared on unmount / desktop width.
  useEffect(() => {
    if (!isMobile) {
      setExtra(null)
      return
    }
    setExtra(
      // No extra padding here — the drawer's SidebarGroup already insets its
      // content, and the drawer ThreadList variant matches that inset.
      <div className="flex flex-col gap-1">
        <Button
          onClick={() => {
            drawerActionsRef.current.handleNewThread()
            drawerActionsRef.current.setOpenMobile(false)
          }}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <MessageSquarePlus className="size-4" />
          New conversation
        </Button>
        <ThreadList
          variant="drawer"
          threads={threads}
          activeThreadId={activeThreadId}
          generatingThreadIds={busyThreadIds}
          unreadThreadIds={unreadThreadIds}
          limit={10}
          onShowAll={() => {
            drawerActionsRef.current.setOpenMobile(false)
            router.push('/insights/chats')
          }}
          onSwitch={(id) => {
            drawerActionsRef.current.handleSwitchThread(id)
            drawerActionsRef.current.setOpenMobile(false)
          }}
          onDelete={(id) => drawerActionsRef.current.handleDeleteThread(id)}
          onRename={(id, title) =>
            drawerActionsRef.current.handleRenameThread(id, title)
          }
        />
      </div>
    )
    return () => setExtra(null)
  }, [isMobile, threads, activeThreadId, busyThreadIds, unreadThreadIds, setExtra, router])

  // Open a specific thread when arrived at via /insights?thread=… (e.g. from the
  // "All chats" page). Runs when the prop changes; the switch handler is read
  // from the ref to avoid re-running on every render.
  useEffect(() => {
    if (initialThreadId && initialThreadId !== threadIdRef.current) {
      drawerActionsRef.current.handleSwitchThread(initialThreadId)
    }
  }, [initialThreadId])

  // Entry point for both the input box and the starter prompts. On a fresh
  // session (no active thread) it creates the thread row first, then sends;
  // otherwise it sends straight to the active thread.
  const handleSend = useCallback(
    async (text: string, attachments?: ChatAttachment[]) => {
      if (!activeThreadId) {
        const gen = ++threadOpRef.current
        const result = await createThread()
        if (!result.data) return
        // The user switched/created elsewhere while this thread was being
        // created — don't hijack their current thread or send into the wrong one.
        if (threadOpRef.current !== gen) return
        setThreads((prev) => [result.data!, ...prev])
        threadIdRef.current = result.data.id
        // Send on the new thread's own Chat, then bind the hook to it. sendOn
        // sets the sidebar title from this first message.
        const instance = ensureChat(result.data.id, [])
        setActiveThreadId(result.data.id)
        setActiveChat(instance)
        sendOn(instance, text, attachments)
        return
      }
      sendOn(ensureChat(activeThreadId), text, attachments)
    },
    [activeThreadId, ensureChat, sendOn]
  )

  // Rebuild the exact context window (system prompt + memory) on demand so the
  // user can inspect what the model receives. Uses the same data passed to the
  // chat transport.
  const loadContext = useCallback(
    () =>
      getInsightsContextPreview({
        markerHistory,
        profile,
        supplements,
        geneticSnps,
        dutchContext,
        microbiomeTests,
        otherTests,
        rmrContext,
      }),
    [markerHistory, profile, supplements, geneticSnps, dutchContext, microbiomeTests, otherTests, rmrContext]
  )

  // Resolve an interactive `ask_user` tool call with the user's selection; the
  // chat then auto-continues (see sendAutomaticallyWhen).
  const handleToolAnswer = useCallback(
    (
      toolCallId: string,
      answer: string | string[] | { choice: 'logged'; href: string } | { choice: 'chat-only' }
    ) => {
      const tool =
        typeof answer === 'object' && !Array.isArray(answer)
          ? 'confirm_health_document_index'
          : 'ask_user'
      chat.addToolOutput({ tool, toolCallId, output: answer })
    },
    [chat]
  )

  // A thread waiting on a dropped answer counts as busy everywhere the live
  // stream does: the thinking indicator on this thread, the pulsing dot on the
  // others. The reply is on its way either way.
  const isRecovering = activeThreadId !== null && recoveringThreadIds.has(activeThreadId)
  const isLoading =
    chat.status === 'streaming' || chat.status === 'submitted' || isRecovering

  // Stop means "I am not waiting any more" — end the live stream AND any wait
  // for a dropped answer on this thread.
  const handleStop = useCallback(() => {
    chat.stop() // ends this browser's stream
    if (activeThreadId) {
      stopRecovery(activeThreadId) // …and any wait for a dropped answer
      // …and tells the server to stop generating (OTH-41). Aborting the
      // request alone cannot do that: the server treats a vanished client as a
      // dropped connection and keeps the answer coming, on purpose. Fire and
      // forget — a stop that fails leaves the run to finish as it used to.
      void fetch('/api/insights-chat/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: activeThreadId }),
      }).catch((error) => console.warn('[insights-chat] stop request failed', error))
    }
  }, [chat, activeThreadId, stopRecovery])

  return (
    <div className="absolute inset-0 flex">
      {!isMobile && (
        <ThreadSidebar
          threads={threads}
          activeThreadId={activeThreadId}
          generatingThreadIds={busyThreadIds}
          unreadThreadIds={unreadThreadIds}
          collapsed={sidebarState === 'collapsed'}
          onSwitchThread={handleSwitchThread}
          onDeleteThread={handleDeleteThread}
          onRenameThread={handleRenameThread}
        />
      )}
      <div className="min-h-0 flex-1">
        <InsightsChat
          messages={chat.messages}
          isLoading={isLoading}
          // While the answer is being waited for, the DROPPED-CONNECTION error
          // is not news the user can act on — the thinking indicator says it
          // better, and it comes back if the wait runs out. Any other error is
          // the server telling the user something, so it always shows.
          error={isRecovering && isConnectionFailure(chat.error) ? undefined : chat.error}
          onSendMessage={handleSend}
          onUploadFile={uploadAttachment}
          onRemoveUpload={removeUpload}
          onStop={handleStop}
          onStarterClick={handleSend}
          onRetry={chat.regenerate}
          onLoadContext={loadContext}
          onToolAnswer={handleToolAnswer}
          onNewThread={handleNewThread}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  )
}
