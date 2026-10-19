'use client'

import { ShieldCheck } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { APP_LOCALE } from '@/lib/locale'

interface VerifiedBadgeProps {
  verifiedAt: string
  sourceUrl: string | null
}

export function VerifiedBadge({ verifiedAt, sourceUrl }: VerifiedBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <ShieldCheck className="inline size-4 text-green-600" />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            Verified {new Date(verifiedAt).toLocaleDateString(APP_LOCALE)}
          </p>
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline"
            >
              View source
            </a>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
