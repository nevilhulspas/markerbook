'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowDown,
  Check,
  Copy,
  FileText,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  RefreshCw,
  SendHorizontal,
  Square,
  X,
} from 'lucide-react'
import type { UIMessage } from 'ai'

import type { ChatAttachment } from '@/lib/database.types'

import { cn } from '@/lib/utils'
import { useKeyboardInset } from '@/hooks/use-keyboard-inset'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Textarea } from '@/components/ui/textarea'
import type { ToolAnswer } from './interactive-tool-part'
import { UserMessage } from './user-message'
import { AssistantMessage } from './assistant-message'
import { ThinkingIndicator } from '@/components/ui/thinking-indicator'
import { ACCEPTED_UPLOAD_ACCEPT_ATTR, filesFromTransfer } from '@/lib/insights/clipboard-files'
import { describesConnectionFailure } from '@/lib/insights/thread-recovery'
import { AiUnavailableNote } from '@/components/interpretation/ai-unavailable-note'

const STARTERS = [
  'Give me an overview of my health',
  'What should I focus on improving?',
  'How are my hormones trending?',
  'Review my supplement stack',
  'Which markers are getting worse?',
]

interface InsightsChatProps {
  messages: UIMessage[]
  isLoading: boolean
  error: Error | undefined
  onSendMessage: (text: string, attachments?: ChatAttachment[]) => void
  /** Uploads one attached file to storage; resolves null when every piece fails. */
  onUploadFile: (file: File) => Promise<ChatAttachment | null>
  /** Deletes uploaded storage objects for an attachment discarded before send. */
  onRemoveUpload: (storagePaths: string[]) => void
  onStop: () => void
  onStarterClick: (text: string) => void
  onRetry: () => void
  onLoadContext: () => Promise<{ data: string | null; error: string | null }>
  onToolAnswer: (toolCallId: string, answer: ToolAnswer) => void
  onNewThread: () => void
  isAdmin: boolean
  /** False when the server has no Anthropic API key: input and starters are off. */
  aiEnabled: boolean
}

/** The AI SDK's own text for a server error it does not pass on. */
const SDK_GENERIC_ERROR = 'An error occurred.'

/**
 * The line shown for a failed turn. A dropped connection gets plain words:
 * the browser's own wording is "Load failed" on iOS and "Failed to fetch" on
 * Chrome. The server sends plain sentences for AI failures; the SDK's generic
 * "An error occurred." (and an empty message) become one here too.
 */
function chatErrorText(error: Error): string {
  if (describesConnectionFailure(error)) return 'The connection dropped before the answer came back.'
  const message = error.message.trim()
  if (!message || message === SDK_GENERIC_ERROR) {
    return 'Something went wrong while answering. Please try again.'
  }
  return message
}

/** A composer attachment: uploading from the moment it's attached, ready once
 *  its storage refs exist, or failed (chip shows the error state). */
interface PendingAttachment {
  id: string
  filename: string
  status: 'uploading' | 'ready' | 'error'
  attachment?: ChatAttachment
}

export function InsightsChat({
  messages,
  isLoading,
  error,
  onSendMessage,
  onUploadFile,
  onRemoveUpload,
  onStop,
  onStarterClick,
  onRetry,
  onLoadContext,
  onToolAnswer,
  onNewThread,
  isAdmin,
  aiEnabled,
}: InsightsChatProps) {
  const [input, setInput] = useState('')
  const [pendingAtts, setPendingAtts] = useState<PendingAttachment[]>([])
  // Chips the user removed while their upload was still in flight: when that
  // upload settles we delete the orphaned storage objects instead of resurrecting
  // the chip.
  const removedUploadsRef = useRef(new Set<string>())
  // Compose-ahead: when the user hits Enter while a response is streaming,
  // queue the message and send it the moment streaming finishes.
  const [sendWhenReady, setSendWhenReady] = useState(false)
  // A queued send was cancelled because every attachment failed to upload —
  // surfaced instead of letting the "queued" note silently vanish.
  const [uploadFailureNotice, setUploadFailureNotice] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const dragDepth = useRef(0)

  // Attach = upload. Each file starts uploading the moment it lands in the
  // composer (paste/drop/picker), so send doesn't have to wait for storage.
  const addFiles = useCallback(
    (files: File[]) => {
      setUploadFailureNotice(false)
      for (const file of files) {
        const id = crypto.randomUUID()
        setPendingAtts((prev) => [
          ...prev,
          { id, filename: file.name, status: 'uploading' },
        ])
        onUploadFile(file)
          .then((attachment) => {
            if (removedUploadsRef.current.delete(id)) {
              // Chip was removed mid-upload — clean up the now-orphaned files.
              if (attachment) onRemoveUpload(attachment.parts ?? [attachment.storagePath])
              return
            }
            setPendingAtts((prev) =>
              prev.map((a) =>
                a.id === id
                  ? attachment
                    ? { ...a, status: 'ready', attachment }
                    : { ...a, status: 'error' }
                  : a
              )
            )
          })
          .catch(() => {
            if (removedUploadsRef.current.delete(id)) return
            setPendingAtts((prev) =>
              prev.map((a) => (a.id === id ? { ...a, status: 'error' } : a))
            )
          })
      }
    },
    [onUploadFile, onRemoveUpload]
  )

  const removeAttachment = useCallback(
    (att: PendingAttachment) => {
      setUploadFailureNotice(false)
      setPendingAtts((prev) => prev.filter((a) => a.id !== att.id))
      if (att.status === 'uploading') {
        removedUploadsRef.current.add(att.id)
      } else if (att.attachment) {
        onRemoveUpload(att.attachment.parts ?? [att.attachment.storagePath])
      }
    },
    [onRemoveUpload]
  )

  const hasUploading = pendingAtts.some((a) => a.status === 'uploading')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputBoxRef = useRef<HTMLDivElement>(null)
  const keyboardInset = useKeyboardInset(inputBoxRef)
  // The input-accessory-bar floor below is iOS-only. On desktop/Android there is
  // no accessory bar, and keyboardInset is 0 there while focused, so an
  // unconditional floor would add a dead 48px gap under the input.
  const isIOS = useMemo(
    () =>
      typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent),
    []
  )
  // iOS draws its floating accessory island ~10pt below the keyboard top it
  // reports via visualViewport (measured on iOS 26), so a flush inset reads as
  // extra air under the input. Trim it so the visible gap below the textarea
  // matches the p-3 gap above it. Adjust if the island shifts on other versions.
  const IOS_ACCESSORY_ISLAND_PT = 10
  const effectiveKeyboardInset =
    isIOS && keyboardInset > 0
      ? keyboardInset - IOS_ACCESSORY_ISLAND_PT
      : keyboardInset

  // iOS scrolls the whole WebView to reveal the focused input, which drags the
  // absolutely-positioned floating controls (menu/Context) up with it (position:
  // fixed doesn't help — iOS moves fixed elements during this scroll too). The
  // input is already kept above the keyboard by the layout, so snap any document
  // scroll back to 0, keeping the controls put in the viewport.
  useEffect(() => {
    const lockScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0)
    }
    window.addEventListener('scroll', lockScroll, { passive: true })
    return () => window.removeEventListener('scroll', lockScroll)
  }, [])

  // Auto-grow the input to fit its content, up to a max height (then it scrolls).
  // Explicit JS sizing (not CSS field-sizing) so it also works in the iOS WebView.
  const INPUT_MAX_PX = 240
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    // When empty, clear the inline height so field-sizing:fixed + rows=1 define a
    // single line. We must NOT measure scrollHeight here: an empty field's
    // scrollHeight includes the (wrapping) placeholder, which balloons the box on
    // narrow screens. Once there's text, the placeholder is hidden and scrollHeight
    // reflects the real content.
    if (!input) {
      el.style.height = ''
      return
    }
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_PX)}px`
  }, [input])

  // Paste files anywhere in the chat (⌘V / Ctrl+V) — not just inside the textarea.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = filesFromTransfer(e.clipboardData)
      if (files.length === 0) return
      // Don't hijack a paste aimed at a different text field on the page; only
      // intercept when focus is in our own composer or not in any text input.
      const active = document.activeElement
      const inForeignField =
        active !== textareaRef.current &&
        (active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          (active instanceof HTMLElement && active.isContentEditable))
      if (inForeignField) return
      e.preventDefault()
      addFiles(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [addFiles])

  // "View context" panel — shows the exact system prompt sent to the model.
  const [showContext, setShowContext] = useState(false)
  const [contextText, setContextText] = useState<string | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [contextError, setContextError] = useState<string | null>(null)
  const [contextCopied, setContextCopied] = useState(false)

  async function handleToggleContext() {
    if (showContext) {
      setShowContext(false)
      return
    }
    setShowContext(true)
    setContextLoading(true)
    setContextError(null)
    const { data, error } = await onLoadContext()
    setContextText(data)
    setContextError(error)
    setContextLoading(false)
  }

  async function handleCopyContext() {
    if (!contextText) return
    await navigator.clipboard.writeText(contextText)
    setContextCopied(true)
    setTimeout(() => setContextCopied(false), 2000)
  }
  // Track whether the user is currently pinned to the bottom of the
  // transcript. Auto-scroll only fires while pinned; if they scroll
  // up mid-stream we leave their viewport alone until they manually
  // return to the bottom.
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true)

  // Pin / unpin based on scroll position. 24px slack tolerates the
  // half-pixel jitter that comes from the streaming text changing
  // the scroll height between frames.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight
      setIsPinnedToBottom(distanceFromBottom < 24)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Auto-scroll only when the user is pinned. New content otherwise
  // grows below the fold and they can read what they paused on.
  useEffect(() => {
    if (!isPinnedToBottom) return
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, isPinnedToBottom, keyboardInset])

  const handleJumpToLatest = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    setIsPinnedToBottom(true)
  }

  const submit = useCallback(() => {
    setSendWhenReady(false)
    const trimmed = input.trim()
    // Failed uploads are skipped (their chips made the failure visible); the
    // composer is cleared either way.
    const ready = pendingAtts
      .filter((a) => a.status === 'ready' && a.attachment)
      .map((a) => a.attachment!)
    if (!trimmed && ready.length === 0) {
      // A queued send can land here when every upload failed — surface that
      // instead of silently dropping the send (the chips stay for retry/remove).
      if (pendingAtts.some((a) => a.status === 'error')) setUploadFailureNotice(true)
      return
    }
    setUploadFailureNotice(false)
    onSendMessage(trimmed, ready.length > 0 ? ready : undefined)
    setInput('')
    setPendingAtts([])
  }, [input, pendingAtts, onSendMessage])

  // Failed-only attachments (with no text) can't be sent — keep the button dead
  // so submit doesn't silently clear them.
  const canSend =
    aiEnabled && (!!input.trim() || pendingAtts.some((a) => a.status !== 'error'))

  const handleSend = () => {
    if (!canSend) return
    // A response is still streaming (or an attachment is still uploading) —
    // queue this message instead of dropping it / sending it without the file.
    if (isLoading || hasUploading) {
      setSendWhenReady(true)
      return
    }
    submit()
  }

  // Flush a queued message once the in-flight response finishes streaming and
  // every attachment upload has settled. Deferred to a microtask so we don't
  // setState synchronously inside the effect.
  useEffect(() => {
    if (isLoading || hasUploading || !sendWhenReady) return
    queueMicrotask(submit)
  }, [isLoading, hasUploading, sendWhenReady, submit])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className="relative flex h-full flex-col bg-card"
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        dragDepth.current += 1
        setIsDraggingFiles(true)
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault() // required so the drop event fires
      }}
      onDragLeave={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        dragDepth.current -= 1
        if (dragDepth.current <= 0) {
          dragDepth.current = 0
          setIsDraggingFiles(false)
        }
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        dragDepth.current = 0
        setIsDraggingFiles(false)
        addFiles(filesFromTransfer(e.dataTransfer))
      }}
    >
      {isDraggingFiles && (
        <div
          role="status"
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <div className="rounded-lg border-2 border-dashed border-primary px-6 py-4 text-sm font-medium text-foreground">
            Drop to attach
          </div>
        </div>
      )}
      {/* Top fade: scrolling messages dissolve into the card color before reaching
          the status bar, so the iOS time/wifi/battery stay legible (and content
          doesn't clutter the notch). Sits below the floating controls (z-20). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[calc(env(safe-area-inset-top)+4rem)] bg-gradient-to-b from-card from-40% to-transparent"
      />
      {/* Floating controls (no top bar): the menu button (left, next to the
          conversation rail) collapses the nav + rail — the layout's global
          trigger is skipped on this page so it doesn't overlay the rail. It
          stays visible even with the context panel open (it's the only nav
          toggle on this page). On the right, "New conversation" takes the
          corner spot and the admin-only "Context" button (system-prompt
          panel) sits beside it; those hide while the context panel is open —
          that panel has its own close button. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-2 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <SidebarTrigger className="pointer-events-auto size-9 rounded-full bg-card/70 text-foreground shadow-sm backdrop-blur-sm" />
        {!showContext && (
          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleContext}
                className="pointer-events-auto gap-1.5 rounded-full bg-card/70 text-muted-foreground shadow-sm backdrop-blur-sm"
                title="View the full context window sent to the AI"
              >
                <FileText className="size-4" />
                Context
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onNewThread}
              className="pointer-events-auto size-9 rounded-full bg-card/70 text-foreground shadow-sm backdrop-blur-sm"
              aria-label="New conversation"
              title="New conversation"
            >
              <MessageSquarePlus className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="relative min-h-0 flex-1">
      {showContext && (
        <div className="absolute inset-0 z-10 flex flex-col bg-card">
          {/* pl-14 + the taller top padding keep the title clear of the
              floating menu button, which stays visible above this panel. */}
          <div className="flex shrink-0 items-center justify-between border-b pb-3 pl-14 pr-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
            <span className="text-sm font-medium">
              Context window — system prompt sent to the AI
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCopyContext}
                className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                title="Copy"
              >
                {contextCopied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowContext(false)}
                className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                title="Close"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {contextLoading ? (
              <p className="text-sm text-muted-foreground">Loading context…</p>
            ) : contextError ? (
              <p className="text-sm text-destructive">{contextError}</p>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
                {contextText}
              </pre>
            )}
          </div>
        </div>
      )}
      <div
        ref={scrollRef}
        className="flex h-full flex-col gap-4 overflow-y-auto px-4 pb-4 pt-[calc(env(safe-area-inset-top)+3.25rem)]"
      >
        {messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8">
            <p className="text-sm text-muted-foreground">
              Start a conversation about your health
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onStarterClick(s)}
                  disabled={!aiEnabled}
                  className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {(() => {
          // Computed once per render (not per message): the last message id (for
          // the streaming flag) and the last assistant id (for the retry button).
          const lastId = messages[messages.length - 1]?.id
          const lastAssistantId = [...messages]
            .reverse()
            .find((m) => m.role === 'assistant')?.id
          return messages.map((message) =>
            message.role === 'user' ? (
              <UserMessage key={message.id} message={message} />
            ) : (
              <AssistantMessage
                key={message.id}
                message={message}
                streaming={isLoading && message.id === lastId}
                isLastAssistant={message.id === lastAssistantId}
                onToolAnswer={onToolAnswer}
                onRetry={onRetry}
              />
            )
          )
        })()}

        {/* Pre-first-token gap: the request is in flight but the assistant
            message doesn't exist yet (still the user's turn on screen), so the
            per-message indicator can't show. Hands off to it once the assistant
            message appears (last message is then the assistant). */}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <ThinkingIndicator />
        )}
      </div>

      {/* Jump-to-latest button — appears when the user has scrolled
          up off the bottom. One tap re-pins them so streaming text
          follows again. */}
      {!isPinnedToBottom && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleJumpToLatest}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-md"
        >
          <ArrowDown className="size-3.5" />
          Jump to latest
        </Button>
      )}
      </div>

      {/* Error, with a way out: the per-message Regenerate button only exists
          once an answer HAS text — which is exactly what a dropped answer
          lacks. See chatErrorText for the wording. */}
      {error && (
        <div className="shrink-0 border-t px-4 py-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm text-destructive">
              {chatErrorText(error)}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 text-sm font-medium text-destructive underline underline-offset-2 hover:no-underline"
            >
              <RefreshCw className="size-3.5" />
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div
        ref={inputBoxRef}
        className="shrink-0 border-t"
        style={{
          // While focused (keyboard up), sit directly above the keyboard — no
          // home-indicator safe-area gap (the keyboard covers it). The iOS-only
          // 3rem floor clears iOS's input-accessory bar (the ‹ › Done strip) in
          // the case where only that bar shows and no full keyboard does — e.g. a
          // hardware/Bluetooth keyboard or the Simulator using the Mac keyboard
          // — where the keyboard inset stays ~0 and the input would otherwise
          // hide behind the bar. When not focused, pad for the home indicator.
          paddingBottom: inputFocused
            ? `max(${effectiveKeyboardInset}px, ${isIOS ? '3rem' : '0px'})`
            : `max(env(safe-area-inset-bottom), ${effectiveKeyboardInset}px)`,
        }}
      >
        {pendingAtts.length > 0 && (
          <div className="flex flex-wrap gap-1 px-3 pt-2">
            {pendingAtts.map((a) => (
              <span
                key={a.id}
                className={cn(
                  'flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs',
                  a.status === 'error' && 'border-destructive/50 text-destructive'
                )}
                title={a.status === 'error' ? 'Upload failed' : undefined}
              >
                {a.status === 'uploading' ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : a.status === 'error' ? (
                  <AlertCircle className="size-3" />
                ) : (
                  <FileText className="size-3" />
                )}
                {a.filename}
                {a.status === 'error' && <span className="font-medium">— failed</span>}
                <button
                  type="button"
                  onClick={() => removeAttachment(a)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${a.filename}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {uploadFailureNotice && (
          <p role="alert" className="px-3 pt-1 text-xs text-destructive">
            Attachment upload failed — message not sent. Remove the failed file or try again.
          </p>
        )}
        {sendWhenReady && (
          <p className="px-3 pt-1 text-xs text-muted-foreground">
            {hasUploading && !isLoading
              ? 'Message queued — will send when the upload finishes…'
              : 'Message queued — will send when the current response finishes…'}
          </p>
        )}
        <div className="flex items-end gap-2 p-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_UPLOAD_ACCEPT_ATTR}
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-[42px] shrink-0"
            disabled={isLoading || !aiEnabled}
            onClick={() => fileInputRef.current?.click()}
            title="Attach a PDF or image"
          >
            <Paperclip className="size-4" />
            <span className="sr-only">Attach file</span>
          </Button>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={aiEnabled ? 'How can I help?' : 'Chat is not available'}
            disabled={!aiEnabled}
            className="field-sizing-fixed min-h-[42px] max-h-[240px] flex-1 resize-none overflow-y-auto"
            rows={1}
          />
          {isLoading ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={onStop}
              className="size-[42px] shrink-0"
            >
              <Square className="size-4" />
              <span className="sr-only">Stop</span>
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              onClick={handleSend}
              disabled={!canSend}
              className={cn('size-[42px] shrink-0', !canSend && 'opacity-50')}
            >
              <SendHorizontal className="size-4" />
              <span className="sr-only">Send</span>
            </Button>
          )}
        </div>
        {!aiEnabled && (
          <AiUnavailableNote
            className="mx-3 mb-2"
            message="Chat needs AI, which is not set up on this server. Ask the admin to add an Anthropic API key."
          />
        )}
        <p className="px-3 pb-2 text-center text-xs text-muted-foreground">
          Not medical advice. Talk to your doctor before you change treatment.
        </p>
      </div>
    </div>
  )
}
