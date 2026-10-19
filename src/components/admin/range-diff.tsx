'use client'

import { useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { verifyRange } from '@/actions/admin/verification'
import { createRange } from '@/actions/admin/ranges'
import { computeRangeDiff } from '@/lib/mayo/diff'
import type { ReferenceRange } from '@/lib/database.types'
import type { ParsedMayoRange, RangeDiffItem } from '@/lib/mayo/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface RangeDiffProps {
  biomarkerId: string
  currentRanges: ReferenceRange[]
  proposedRanges: ParsedMayoRange[]
  sourceUrl: string
  onComplete: () => void
}

type RowStatus = 'pending' | 'applying' | 'applied' | 'skipped'

export function RangeDiff({
  biomarkerId,
  currentRanges,
  proposedRanges,
  sourceUrl,
  onComplete,
}: RangeDiffProps) {
  const diffItems = computeRangeDiff(currentRanges, proposedRanges)
  const [statuses, setStatuses] = useState<Record<number, RowStatus>>(
    () => Object.fromEntries(diffItems.map((_, i) => [i, 'pending']))
  )

  function updateStatus(index: number, status: RowStatus) {
    setStatuses(prev => {
      const next = { ...prev, [index]: status }
      // Check if all done
      const allDone = diffItems.every((_, i) =>
        next[i] === 'applied' || next[i] === 'skipped'
      )
      if (allDone) setTimeout(onComplete, 500)
      return next
    })
  }

  async function handleApply(index: number, item: RangeDiffItem) {
    updateStatus(index, 'applying')

    if (item.rangeId) {
      // Update existing range with verification
      const result = await verifyRange(item.rangeId, {
        range_low: item.proposed.range_low,
        range_high: item.proposed.range_high,
        source: 'Mayo Clinic Laboratories',
        source_url: sourceUrl,
      })
      if (result.success) {
        toast.success('Range verified')
        updateStatus(index, 'applied')
      } else {
        toast.error(result.error)
        updateStatus(index, 'pending')
      }
    } else {
      // Create new range (no existing match)
      const result = await createRange({
        biomarker_id: biomarkerId,
        unit: item.proposed.unit,
        sex: item.proposed.sex,
        age_min: null,
        age_max: null,
        range_low: item.proposed.range_low,
        range_high: item.proposed.range_high,
        source: 'Mayo Clinic Laboratories',
        range_type: 'normal',
      })
      if (result.success) {
        toast.success('New range created')
        updateStatus(index, 'applied')
      } else {
        toast.error(result.error)
        updateStatus(index, 'pending')
      }
    }
  }

  function handleSkip(index: number) {
    updateStatus(index, 'skipped')
  }

  if (diffItems.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No ranges extracted to compare.
      </p>
    )
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Component</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Sex</TableHead>
            <TableHead>Current Low</TableHead>
            <TableHead>Current High</TableHead>
            <TableHead>Proposed Low</TableHead>
            <TableHead>Proposed High</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {diffItems.map((item, index) => {
            const status = statuses[index]
            const isProcessed = status === 'applied' || status === 'skipped'
            const lowChanged = item.current
              ? item.current.range_low !== item.proposed.range_low
              : true
            const highChanged = item.current
              ? item.current.range_high !== item.proposed.range_high
              : true

            return (
              <TableRow
                key={index}
                className={isProcessed ? 'opacity-50' : undefined}
              >
                <TableCell className="font-medium">
                  {item.proposed.component}
                </TableCell>
                <TableCell>{item.proposed.unit}</TableCell>
                <TableCell className="capitalize">{item.proposed.sex}</TableCell>

                {/* Current values */}
                <TableCell className="text-muted-foreground">
                  {item.current ? (item.current.range_low ?? '-') : (
                    <Badge variant="outline">New</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.current ? (item.current.range_high ?? '-') : (
                    <Badge variant="outline">New</Badge>
                  )}
                </TableCell>

                {/* Proposed values */}
                <TableCell
                  className={lowChanged ? 'text-green-600 font-semibold' : undefined}
                >
                  {item.proposed.range_low ?? '-'}
                </TableCell>
                <TableCell
                  className={highChanged ? 'text-green-600 font-semibold' : undefined}
                >
                  {item.proposed.range_high ?? '-'}
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right">
                  {status === 'applied' && (
                    <Check className="inline size-4 text-green-600" />
                  )}
                  {status === 'skipped' && (
                    <X className="inline size-4 text-muted-foreground" />
                  )}
                  {status === 'applying' && (
                    <Loader2 className="inline size-4 animate-spin" />
                  )}
                  {status === 'pending' && (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApply(index, item)}
                      >
                        Apply
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSkip(index)}
                      >
                        Skip
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
