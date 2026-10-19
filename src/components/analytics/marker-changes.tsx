'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarkerChange } from '@/lib/analytics/marker-changes'
import type { RangeStatus } from '@/lib/grid/reference-range'

/** Max number of change badges to display */
const MAX_DISPLAY = 8

/**
 * Determine if a marker change represents improvement or worsening.
 * Improvement: moved toward 'normal'. Worsening: moved away from 'normal'.
 */
function getChangeQuality(
  current: RangeStatus,
  previous: RangeStatus
): 'improved' | 'worsened' | 'neutral' {
  const statusWeight: Record<RangeStatus, number> = {
    normal: 0,
    borderline: 1,
    'out-of-range': 2,
    unknown: -1,
  }

  const currentW = statusWeight[current]
  const previousW = statusWeight[previous]

  // If either is unknown, we can't determine quality
  if (currentW === -1 || previousW === -1) return 'neutral'

  if (currentW < previousW) return 'improved'
  if (currentW > previousW) return 'worsened'
  return 'neutral'
}

function getQualityStyles(quality: 'improved' | 'worsened' | 'neutral') {
  switch (quality) {
    case 'improved':
      return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800'
    case 'worsened':
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800'
    case 'neutral':
      return 'bg-muted text-muted-foreground border-border'
  }
}

interface MarkerChangesBannerProps {
  changes: MarkerChange[]
}

export function MarkerChangesBanner({ changes }: MarkerChangesBannerProps) {
  const [expanded, setExpanded] = useState(false)

  if (changes.length === 0) return null

  const improved = changes.filter(
    (c) => getChangeQuality(c.status, c.previousStatus) === 'improved'
  ).length
  const worsened = changes.filter(
    (c) => getChangeQuality(c.status, c.previousStatus) === 'worsened'
  ).length

  const displayChanges = expanded ? changes : changes.slice(0, MAX_DISPLAY)

  return (
    <div className="rounded-lg border bg-card p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-sm"
      >
        <span className="font-medium">
          {changes.length} marker{changes.length !== 1 ? 's' : ''} changed
          {improved > 0 && (
            <span className="ml-2 text-green-600 dark:text-green-400">
              {improved} improved
            </span>
          )}
          {worsened > 0 && (
            <span className="ml-2 text-red-600 dark:text-red-400">
              {worsened} worsened
            </span>
          )}
        </span>
        {expanded ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {displayChanges.map((change) => {
            const quality = getChangeQuality(change.status, change.previousStatus)
            const ArrowIcon =
              change.direction === 'up' ? TrendingUp : TrendingDown
            const pctStr =
              Math.abs(change.percentChange) < 0.1
                ? '<0.1'
                : Math.abs(change.percentChange).toFixed(1)

            return (
              <span
                key={change.biomarkerId}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                  getQualityStyles(quality)
                )}
              >
                <span className="max-w-[120px] truncate">
                  {change.markerName}
                </span>
                <ArrowIcon className="size-3" />
                <span className="tabular-nums">{pctStr}%</span>
              </span>
            )
          })}
          {!expanded && changes.length > MAX_DISPLAY && (
            <span className="inline-flex items-center px-2 text-xs text-muted-foreground">
              +{changes.length - MAX_DISPLAY} more
            </span>
          )}
        </div>
      )}
    </div>
  )
}
