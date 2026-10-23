import Link from 'next/link'
import { Info } from 'lucide-react'

import { cn } from '@/lib/utils'

interface AiUnavailableNoteProps {
  /** What does not work without AI, in one short sentence. */
  message?: string
  /** Where the user can still enter data by hand. */
  manualHref?: string
  manualLabel?: string
  className?: string
}

/**
 * The short muted note shown where an AI feature is switched off because the
 * server has no Anthropic API key (see isAiConfigured).
 */
export function AiUnavailableNote({
  message = 'AI features are not set up on this server.',
  manualHref,
  manualLabel = 'Enter results by hand',
  className,
}: AiUnavailableNoteProps) {
  return (
    <div
      role="note"
      className={cn(
        'flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground',
        className
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0" />
      <p>
        {message}
        {manualHref && (
          <>
            {' '}
            <Link href={manualHref} className="font-medium text-foreground underline underline-offset-2">
              {manualLabel}
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
