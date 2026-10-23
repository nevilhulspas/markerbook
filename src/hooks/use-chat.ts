'use client'

import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import { readTextStream } from '@/lib/ai/text-stream'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

interface UseChatReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  sendMessage: (text: string) => Promise<void>
  abort: () => void
  reset: () => void
}

interface UseChatOptions {
  /** The test (and, for a single marker, the result) the chat is about. The
   *  server loads the markers and profile for it from the user's own data. */
  bloodTestId?: string
  testResultId?: string
  initialInterpretation?: string
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const { bloodTestId, testResultId, initialInterpretation } = options

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialInterpretation) {
      return [
        {
          id: 'initial-interpretation',
          role: 'assistant' as const,
          content: initialInterpretation,
        },
      ]
    }
    return []
  })
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const optionsRef = useRef(options)
  // Sync after commit (not during render); runs before any handler can read it.
  useLayoutEffect(() => {
    optionsRef.current = options
  })

  const sendMessage = useCallback(
    async (text: string) => {
      // Abort any ongoing stream
      abortControllerRef.current?.abort()

      const controller = new AbortController()
      abortControllerRef.current = controller

      setError(null)

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        isStreaming: true,
      }

      // Append user + placeholder assistant message
      setMessages((prev) => [...prev, userMessage, assistantMessage])
      setIsStreaming(true)

      // Build API messages array (exclude the streaming placeholder)
      const currentMessages = await new Promise<ChatMessage[]>((resolve) => {
        setMessages((prev) => {
          // prev includes user + assistant placeholder
          // API messages = all except the last (streaming placeholder)
          resolve(prev.slice(0, -1))
          return prev
        })
      })

      const apiMessages = currentMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: apiMessages,
            bloodTestId,
            testResultId,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const responseText = await response.text()
          throw new Error(responseText || `Request failed (${response.status})`)
        }

        // Update the last (assistant) message's content progressively. A
        // mid-stream AI failure throws, which drops the partial reply below.
        await readTextStream(response, (chunk) => {
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            updated[updated.length - 1] = {
              ...last,
              content: last.content + chunk,
            }
            return updated
          })
        })

        // Mark streaming complete
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          updated[updated.length - 1] = {
            ...last,
            isStreaming: false,
          }
          return updated
        })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // User aborted -- not an error
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            updated[updated.length - 1] = { ...last, isStreaming: false }
            return updated
          })
          setIsStreaming(false)
          return
        }

        const message =
          err instanceof Error ? err.message : 'Failed to send message'
        setError(message)

        // Remove the placeholder assistant message on error
        setMessages((prev) => prev.slice(0, -1))
      } finally {
        setIsStreaming(false)
      }
    },
    [bloodTestId, testResultId]
  )

  const abort = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
  }, [])

  const reset = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
    setError(null)

    // Keep initial interpretation if it was provided
    if (optionsRef.current.initialInterpretation) {
      setMessages([
        {
          id: 'initial-interpretation',
          role: 'assistant',
          content: optionsRef.current.initialInterpretation,
        },
      ])
    } else {
      setMessages([])
    }
  }, [])

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    abort,
    reset,
  }
}
