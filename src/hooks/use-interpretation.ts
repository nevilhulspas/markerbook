'use client'

import { useCallback, useRef, useState } from 'react'

import {
  getCachedInterpretation,
  saveInterpretation,
} from '@/actions/interpretation'
import type { InterpretationRequest } from '@/lib/interpretation/types'
import { REASONING_MODEL } from '@/lib/ai/models'
import { readTextStream } from '@/lib/ai/text-stream'

interface UseInterpretationReturn {
  content: string
  isStreaming: boolean
  isLoading: boolean
  error: string | null
  cachedAt: string | null
  isStale: boolean
  interpret: (
    request: InterpretationRequest,
    profileHash: string,
    markerContextHash: string
  ) => Promise<void>
  regenerate: () => void
  abort: () => void
  reset: () => void
}

export function useInterpretation(): UseInterpretationReturn {
  const [content, setContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [isStale, setIsStale] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const lastRequestRef = useRef<{
    request: InterpretationRequest
    profileHash: string
    markerContextHash: string
  } | null>(null)

  const startStreaming = useCallback(
    async (
      request: InterpretationRequest,
      profileHash: string,
      markerContextHash: string
    ) => {
      // Abort any ongoing stream
      abortControllerRef.current?.abort()

      const controller = new AbortController()
      abortControllerRef.current = controller

      setContent('')
      setIsStreaming(true)
      setIsLoading(false)
      setError(null)
      setCachedAt(null)
      setIsStale(false)

      try {
        const response = await fetch('/api/interpret', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: controller.signal,
        })

        if (!response.ok) {
          const text = await response.text()
          throw new Error(text || `Request failed (${response.status})`)
        }

        // Throws on a mid-stream AI failure, so a broken answer is never cached.
        const accumulated = await readTextStream(response, (chunk) =>
          setContent((prev) => prev + chunk)
        )

        // Cache the completed interpretation
        if (accumulated && !controller.signal.aborted) {
          await saveInterpretation({
            bloodTestId: request.bloodTestId,
            testResultId: request.testResultId,
            type: request.type,
            content: accumulated,
            profileHash,
            markerContextHash,
            model: REASONING_MODEL,
          })
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // User aborted -- not an error
          return
        }
        const message =
          err instanceof Error ? err.message : 'Failed to interpret'
        setError(message)
      } finally {
        setIsStreaming(false)
      }
    },
    []
  )

  const interpret = useCallback(
    async (
      request: InterpretationRequest,
      profileHash: string,
      markerContextHash: string
    ) => {
      lastRequestRef.current = { request, profileHash, markerContextHash }

      setIsLoading(true)
      setError(null)
      setContent('')
      setCachedAt(null)
      setIsStale(false)

      // Check cache first
      try {
        const cached = await getCachedInterpretation({
          bloodTestId: request.bloodTestId,
          testResultId: request.testResultId,
          type: request.type,
          profileHash,
          markerContextHash,
        })

        if ('error' in cached) {
          setError(cached.error)
          setIsLoading(false)
          return
        }

        if (cached.data) {
          setContent(cached.data.content)
          setCachedAt(cached.data.created_at)

          if (cached.stale) {
            setIsStale(true)
          }

          setIsLoading(false)
          return
        }
      } catch {
        // Cache check failed, proceed to stream
      }

      // No cache or cache error -- start streaming
      await startStreaming(request, profileHash, markerContextHash)
    },
    [startStreaming]
  )

  const regenerate = useCallback(() => {
    const last = lastRequestRef.current
    if (!last) return
    startStreaming(last.request, last.profileHash, last.markerContextHash)
  }, [startStreaming])

  const abort = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
  }, [])

  const reset = useCallback(() => {
    abortControllerRef.current?.abort()
    setContent('')
    setIsStreaming(false)
    setIsLoading(false)
    setError(null)
    setCachedAt(null)
    setIsStale(false)
    lastRequestRef.current = null
  }, [])

  return {
    content,
    isStreaming,
    isLoading,
    error,
    cachedAt,
    isStale,
    interpret,
    regenerate,
    abort,
    reset,
  }
}
