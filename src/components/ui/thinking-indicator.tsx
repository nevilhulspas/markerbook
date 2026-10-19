'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Fills the silent gap while the model reasons. With adaptive thinking the
 * model streams NO visible text until it finishes thinking (thinking display
 * defaults to "omitted"), so surfaces would otherwise show nothing for several
 * seconds. Render this whenever a reasoning-enabled stream is in flight but no
 * answer text has arrived yet. It self-times an elapsed-seconds counter so the
 * wait reads as intentional, not a stall.
 */
export function ThinkingIndicator({
  className,
  label = 'Thinking…',
}: {
  className?: string
  label?: string
}) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border bg-muted/20 px-2.5 py-1.5 text-sm text-muted-foreground',
        className,
      )}
    >
      <Loader2 className="size-3.5 animate-spin" />
      <span>{label}</span>
      {/* aria-hidden: role="status" is aria-atomic, so without this the ticking
          counter would re-announce "Thinking… 1s / 2s / …" every second. */}
      {seconds > 0 && (
        <span aria-hidden="true" className="tabular-nums text-xs text-muted-foreground/70">
          {seconds}s
        </span>
      )}
    </div>
  )
}
