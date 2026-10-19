'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MayoExtractor } from '@/components/admin/mayo-extractor'
import { RangeDiff } from '@/components/admin/range-diff'
import type { ReferenceRange } from '@/lib/database.types'
import type { ParsedMayoRange } from '@/lib/mayo/types'
import { Button } from '@/components/ui/button'

interface VerificationTabProps {
  biomarkerId: string
  ranges: ReferenceRange[]
}

export function VerificationTab({ biomarkerId, ranges }: VerificationTabProps) {
  const router = useRouter()
  const [extractedRanges, setExtractedRanges] = useState<ParsedMayoRange[] | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')

  function handleExtracted(ranges: ParsedMayoRange[], url: string) {
    setExtractedRanges(ranges)
    setSourceUrl(url)
  }

  function handleComplete() {
    setExtractedRanges(null)
    setSourceUrl('')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Extract ranges */}
      {!extractedRanges && (
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-4">
            Extract Reference Ranges from Mayo Clinic
          </h3>
          <MayoExtractor onExtracted={handleExtracted} />
        </div>
      )}

      {/* Step 2: Review and apply diff */}
      {extractedRanges && (
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">
              Review Extracted Ranges ({extractedRanges.length})
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setExtractedRanges(null)}>
              Start Over
            </Button>
          </div>
          <RangeDiff
            biomarkerId={biomarkerId}
            currentRanges={ranges}
            proposedRanges={extractedRanges}
            sourceUrl={sourceUrl}
            onComplete={handleComplete}
          />
        </div>
      )}

      {/* Verification stats */}
      <div className="text-xs text-muted-foreground">
        {ranges.filter(r => r.verified_at).length} of {ranges.length} ranges verified
      </div>
    </div>
  )
}
