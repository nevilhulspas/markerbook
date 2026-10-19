'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { InterpretationContent } from '@/components/interpretation/interpretation-content'
import { readTextStream } from '@/lib/ai/text-stream'

interface AiDescriptionProps {
  biomarkerId: string
  cachedContent: string | null
  isStale: boolean
  cachedAt: string | null
  /** Which catalogue the marker belongs to (DUTCH markers have their own). */
  descriptionTarget?: 'biomarker' | 'dutch_marker'
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

export function AiDescription({
  biomarkerId,
  cachedContent,
  isStale,
  cachedAt,
  descriptionTarget = 'biomarker',
}: AiDescriptionProps) {
  const [content, setContent] = useState(cachedContent ?? '')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localCachedAt, setLocalCachedAt] = useState(cachedAt)
  const [localIsStale, setLocalIsStale] = useState(isStale)

  const abortControllerRef = useRef<AbortController | null>(null)
  const hasAutoTriggered = useRef(false)

  const generate = useCallback(async () => {
    abortControllerRef.current?.abort()

    const controller = new AbortController()
    abortControllerRef.current = controller

    setContent('')
    setIsStreaming(true)
    setError(null)
    setLocalCachedAt(null)
    setLocalIsStale(false)

    try {
      const response = await fetch('/api/catalog/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Only which marker: the server reads the catalogue context itself and
        // stores the finished description (OTH-79).
        body: JSON.stringify({ markerId: biomarkerId, target: descriptionTarget }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Request failed (${response.status})`)
      }

      // Throws on a mid-stream AI failure; the server then stores nothing.
      await readTextStream(response, (chunk) => setContent((prev) => prev + chunk))
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      const message =
        err instanceof Error ? err.message : 'Failed to generate description'
      setError(message)
    } finally {
      setIsStreaming(false)
    }
  }, [biomarkerId, descriptionTarget])

  // Auto-trigger generation when no cached content exists
  useEffect(() => {
    if (!cachedContent && !hasAutoTriggered.current) {
      hasAutoTriggered.current = true
      generate()
    }
  }, [cachedContent, generate])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            About This Biomarker
          </CardTitle>
          {localCachedAt && !localIsStale && !isStreaming && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                Cached {formatRelativeTime(localCachedAt)}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="h-auto px-2 py-1 text-xs"
                onClick={generate}
              >
                <RefreshCw className="size-3" />
                Regenerate
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Stale cache banner */}
        {localIsStale && !isStreaming && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="flex-1 text-sm text-amber-700 dark:text-amber-300">
              Biomarker data has changed since this description was generated.
            </p>
            <Button size="sm" variant="outline" onClick={generate}>
              <RefreshCw className="size-3" />
              Regenerate
            </Button>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="space-y-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={generate}>
              Try again
            </Button>
          </div>
        )}

        {/* Content (cached or streaming) */}
        {content && (
          <InterpretationContent content={content} isStreaming={isStreaming} />
        )}

        {/* Loading state with no content yet */}
        {isStreaming && !content && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="size-4 animate-spin" />
            Generating description...
          </div>
        )}

        {/* No content and not loading (should not normally happen) */}
        {!content && !isStreaming && !error && !cachedContent && (
          <p className="text-sm text-muted-foreground">
            No description available yet.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
