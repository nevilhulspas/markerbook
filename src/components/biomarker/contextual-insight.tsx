'use client'

import { sameUnit } from '@/lib/units/parse'

import { useEffect, useRef } from 'react'
import { Brain, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { InterpretationContent } from '@/components/interpretation/interpretation-content'
import { ThinkingIndicator } from '@/components/ui/thinking-indicator'
import { useInterpretation } from '@/hooks/use-interpretation'
import { isAiNotConfiguredMessage } from '@/lib/ai/messages'
import { AiUnavailableNote } from '@/components/interpretation/ai-unavailable-note'
import { hashProfile, hashMarkerContext } from '@/lib/interpretation/cache'
import type {
  InterpretationRequest,
  MarkerContext,
  ProfileContext,
} from '@/lib/interpretation/types'

interface ContextualInsightProps {
  biomarkerName: string
  biomarkerId: string
  unit: string
  testResults: Array<{
    id: string
    value: number
    unit?: string
    date: string
    testName: string
    bloodTestId: string
  }>
  refRangeLow: number | null
  refRangeHigh: number | null
  profile: ProfileContext
  allMarkerContextForLatestTest: MarkerContext[]
  /** False when the server has no Anthropic API key: only a cached insight shows. */
  aiEnabled?: boolean
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

function computeStatus(
  value: number,
  low: number | null,
  high: number | null
): string {
  if (low != null && value < low) return 'low'
  if (high != null && value > high) return 'high'
  return 'normal'
}

export function ContextualInsight({
  biomarkerName,
  unit,
  testResults,
  refRangeLow,
  refRangeHigh,
  profile,
  allMarkerContextForLatestTest,
  aiEnabled = true,
}: ContextualInsightProps) {
  const {
    content,
    isStreaming,
    isLoading,
    error,
    cachedAt,
    isStale,
    interpret,
    regenerate,
  } = useInterpretation({ aiEnabled })

  const hasTriggered = useRef(false)

  useEffect(() => {
    if (testResults.length === 0 || hasTriggered.current) return
    hasTriggered.current = true

    const latest = testResults[testResults.length - 1]

    const request: InterpretationRequest = {
      type: 'biomarker_insight',
      userId: '', // hook reads from server action
      bloodTestId: latest.bloodTestId,
      testResultId: latest.id,
      markerName: biomarkerName,
      markerValue: latest.value,
      // The latest value's own unit: the page converts to the catalogue unit
      // where it can, and the range applies only when the units match.
      markerUnit: latest.unit ?? unit,
      refRangeLow: sameUnit(latest.unit ?? unit, unit) ? refRangeLow : null,
      refRangeHigh: sameUnit(latest.unit ?? unit, unit) ? refRangeHigh : null,
      status: sameUnit(latest.unit ?? unit, unit)
        ? computeStatus(latest.value, refRangeLow, refRangeHigh)
        : 'unknown',
      allTestResults: allMarkerContextForLatestTest,
      profile,
      historicalValues: testResults.map((r) => ({
        date: r.date,
        value: r.value,
        unit: r.unit,
        testName: r.testName,
      })),
    }

    const profHash = hashProfile(profile)

    // Hash based on this biomarker's test history for cache invalidation
    const biomarkerMarkerContexts: MarkerContext[] = testResults.map((r) => ({
      name: biomarkerName,
      shortName: null,
      value: r.value,
      unit,
      category: '',
      refRangeLow,
      refRangeHigh,
      status: '',
    }))
    const ctxHash = hashMarkerContext(biomarkerMarkerContexts)

    interpret(request, profHash, ctxHash)
  }, [
    testResults,
    biomarkerName,
    unit,
    refRangeLow,
    refRangeHigh,
    profile,
    allMarkerContextForLatestTest,
    interpret,
  ])

  // No test data state
  if (testResults.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="size-5" />
            Your Insight
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Import a blood test with {biomarkerName} results to get a
            personalized insight.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="size-5" />
            Your Insight
          </CardTitle>
          {cachedAt && !isStale && !isStreaming && aiEnabled && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                Cached {formatRelativeTime(cachedAt)}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="h-auto px-2 py-1 text-xs"
                onClick={regenerate}
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
        {isStale && !isStreaming && aiEnabled && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="flex-1 text-sm text-amber-700 dark:text-amber-300">
              Your profile or markers have changed since this insight was
              generated.
            </p>
            <Button size="sm" variant="outline" onClick={regenerate}>
              <RefreshCw className="size-3" />
              Regenerate
            </Button>
          </div>
        )}

        {/* Not set up: a note, not an error */}
        {error && isAiNotConfiguredMessage(error) && (
          <AiUnavailableNote message="Personal insights need AI, which is not set up on this server." />
        )}

        {/* Error state */}
        {error && !isAiNotConfiguredMessage(error) && (
          <div className="space-y-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={regenerate}>
              Try again
            </Button>
          </div>
        )}

        {/* Loading state (cache check) */}
        {isLoading && !content && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="size-4 animate-spin" />
            Generating insight...
          </div>
        )}

        {/* Reasoning gap: streaming, but adaptive thinking hasn't emitted text yet. */}
        {isStreaming && !content && <ThinkingIndicator />}

        {/* Content (cached or streaming) */}
        {content && (
          <>
            <InterpretationContent content={content} isStreaming={isStreaming} />
            <p className="mt-3 text-xs text-muted-foreground">
              Not medical advice. Talk to your doctor before you change treatment.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
