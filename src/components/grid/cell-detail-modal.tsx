'use client'

import Link from 'next/link'
import { Pencil } from 'lucide-react'

import { useIsMobile } from '@/hooks/use-mobile'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  getStatusColor,
  getStatusLabel,
  type RangeStatus,
} from '@/lib/grid/reference-range'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ReferenceRangeBar } from '@/components/biomarker/reference-range-bar'
import { InterpretButton } from '@/components/interpretation/interpret-button'
import { TrendChart } from '@/components/analytics/trend-chart'
import type { TrendData } from '@/lib/analytics/marker-trends'
import { APP_LOCALE } from '@/lib/locale'

export interface CellDetailData {
  markerName: string
  value: number
  unit: string
  testDate: string
  testName: string
  status: RangeStatus
  refRangeLow: number | null
  refRangeHigh: number | null
  biomarkerDescription: string | null
  biomarkerId: string
  bloodTestId: string
}

interface CellDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: CellDetailData | null
  trendData?: TrendData | null
  onInterpret?: () => void
  isInterpretLoading?: boolean
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return new Intl.DateTimeFormat(APP_LOCALE, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function CellDetailContent({
  data,
  trendData,
  onInterpret,
  isInterpretLoading,
}: {
  data: CellDetailData
  trendData?: TrendData | null
  onInterpret?: () => void
  isInterpretLoading?: boolean
}) {
  const formatted = Number.isInteger(data.value)
    ? data.value
    : data.value.toFixed(2)

  return (
    // min-w-0: this is a direct child of the DialogContent grid (and the mobile
    // Drawer). Without it the column keeps the chart's intrinsic min-width and
    // the trend chart overflows past the card edge.
    <div className="min-w-0 space-y-4">
      {/* Value display */}
      <div className="text-center">
        <div className="text-3xl font-bold">
          {formatted}{' '}
          <span className="text-lg font-normal text-muted-foreground">
            {data.unit}
          </span>
        </div>
      </div>

      {/* Status badge */}
      <div className="flex justify-center">
        <span
          className={cn(
            'rounded-full px-3 py-1 text-sm font-medium',
            getStatusColor(data.status)
          )}
        >
          {getStatusLabel(data.status)}
        </span>
      </div>

      {/* Reference range visualization */}
      {data.refRangeLow != null && data.refRangeHigh != null && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Reference Range</p>
          <ReferenceRangeBar
            value={data.value}
            low={data.refRangeLow}
            high={data.refRangeHigh}
            status={data.status}
          />
          <p className="text-sm text-muted-foreground">
            {data.refRangeLow} - {data.refRangeHigh} {data.unit}
          </p>
        </div>
      )}

      {data.status === 'unknown' && (
        <p className="text-sm text-muted-foreground">
          No reference range available for this biomarker.
        </p>
      )}

      {/* Trend chart */}
      {trendData && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-medium">Trend</p>
          <TrendChart data={trendData} />
        </div>
      )}

      {/* Biomarker description */}
      {data.biomarkerDescription && (
        <div className="space-y-1">
          <p className="text-sm font-medium">About</p>
          <p className="text-sm text-muted-foreground">
            {data.biomarkerDescription}
          </p>
        </div>
      )}

      {/* Interpret button */}
      {onInterpret && (
        <InterpretButton
          onClick={onInterpret}
          isLoading={isInterpretLoading}
        />
      )}
    </div>
  )
}

export function CellDetailModal({
  open,
  onOpenChange,
  data,
  trendData,
  onInterpret,
  isInterpretLoading,
}: CellDetailModalProps) {
  const isMobile = useIsMobile()

  if (!data) return null

  const formattedDate = formatDate(data.testDate)
  const description = `${data.testName} - ${formattedDate}`

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <DrawerTitle>{data.markerName}</DrawerTitle>
                <DrawerDescription>
                  <Link
                    href={`/tests/${data.bloodTestId}/edit#marker-${data.biomarkerId}`}
                    className="hover:underline"
                  >
                    {description}
                  </Link>
                </DrawerDescription>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" asChild>
                <Link href={`/tests/${data.bloodTestId}/edit#marker-${data.biomarkerId}`}>
                  <Pencil className="size-4" />
                  <span className="sr-only">Edit blood test</span>
                </Link>
              </Button>
            </div>
          </DrawerHeader>
          <div className="p-4 pb-8">
            <CellDetailContent
              data={data}
              trendData={trendData}
              onInterpret={onInterpret}
              isInterpretLoading={isInterpretLoading}
            />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <DialogTitle>{data.markerName}</DialogTitle>
              <DialogDescription>
                <Link
                  href={`/tests/${data.bloodTestId}/edit#marker-${data.biomarkerId}`}
                  className="hover:underline"
                >
                  {description}
                </Link>
              </DialogDescription>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0" asChild>
              <Link href={`/tests/${data.bloodTestId}/edit#marker-${data.biomarkerId}`}>
                <Pencil className="size-4" />
                <span className="sr-only">Edit blood test</span>
              </Link>
            </Button>
          </div>
        </DialogHeader>
        <CellDetailContent
          data={data}
          trendData={trendData}
          onInterpret={onInterpret}
          isInterpretLoading={isInterpretLoading}
        />
      </DialogContent>
    </Dialog>
  )
}
