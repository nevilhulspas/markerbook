'use client'

import { useRef, useState } from 'react'
import { Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { saveOtherInterpretation } from '@/actions/other-tests'
import { Button } from '@/components/ui/button'
import { AiUnavailableNote } from '@/components/interpretation/ai-unavailable-note'
import { InterpretationContent } from '@/components/interpretation/interpretation-content'
import { ThinkingIndicator } from '@/components/ui/thinking-indicator'
import { readTextStream } from '@/lib/ai/text-stream'

/**
 * The Interpret button for an "other" test. Streams from /api/other/interpret,
 * renders the markdown live, and persists the finished text back onto the row
 * so it shows again on the next visit.
 */
export function OtherInterpretPanel({
  testId,
  initialContent,
  aiEnabled = true,
}: {
  testId: string
  initialContent: string | null
  /** False when the server has no Anthropic key (isAiConfigured). */
  aiEnabled?: boolean
}) {
  const [content, setContent] = useState(initialContent ?? '')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function run() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsStreaming(true)
    setError(null)
    setContent('')

    try {
      const res = await fetch('/api/other/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Request failed (${res.status})`)
      }
      // Throws on a mid-stream AI failure, so a broken answer is never saved.
      const accumulated = await readTextStream(res, (chunk) => setContent((prev) => prev + chunk))

      if (accumulated && !controller.signal.aborted) {
        const { error: saveError } = await saveOtherInterpretation(testId, accumulated)
        if (saveError) toast.error(`Interpretation didn't save: ${saveError}`)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Could not interpret this test. Please try again.')
    } finally {
      setIsStreaming(false)
    }
  }

  const hasContent = content.trim().length > 0

  if (!hasContent && !isStreaming) {
    if (!aiEnabled) {
      return <AiUnavailableNote message="AI interpretation is not set up on this server." />
    }
    return (
      <div className="space-y-2">
        <Button onClick={run}>
          <Sparkles className="size-4" />
          Interpret this test
        </Button>
        <p className="text-xs text-muted-foreground">
          Uses AI to explain what this result means in the context of your profile.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Reasoning gap: streaming, but adaptive thinking hasn't emitted text yet. */}
      {isStreaming && !hasContent ? (
        <ThinkingIndicator />
      ) : (
        <InterpretationContent content={content} isStreaming={isStreaming} />
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!isStreaming && (
        <p className="text-xs text-muted-foreground">
          Not medical advice. Talk to your doctor before you change treatment.
        </p>
      )}
      {aiEnabled && (
        <Button variant="outline" size="sm" onClick={run} disabled={isStreaming}>
          {isStreaming ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {isStreaming ? 'Interpreting…' : 'Re-interpret'}
        </Button>
      )}
    </div>
  )
}
