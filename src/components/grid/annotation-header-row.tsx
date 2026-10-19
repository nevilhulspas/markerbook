'use client'

import { useMemo } from 'react'
import type { useReactTable } from '@tanstack/react-table'

import type { Annotation } from '@/lib/database.types'
import type { GridRow } from '@/lib/grid/grid-types'
import { AnnotationPopover } from '@/components/annotations/annotation-popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getColumnPinningStyles, STATIC_COLUMN_IDS } from './grid-layout'

/**
 * Annotation dot with tooltip + popover for a test-date cell.
 */
function AnnotationDotCell({
  annotations,
  date,
  onEdit,
  onAddNew,
}: {
  annotations: Annotation[]
  date: string
  onEdit: (annotation: Annotation) => void
  onAddNew: (date: string) => void
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <AnnotationPopover annotations={annotations} date={date} onEdit={onEdit} onAddNew={onAddNew}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="relative mx-auto flex size-6 items-center justify-center rounded-full transition-colors hover:bg-accent"
            >
              <span className="size-2.5 rounded-full bg-primary/70" />
            </button>
          </TooltipTrigger>
        </AnnotationPopover>
        <TooltipContent side="top" sideOffset={4}>
          <span className="max-w-48 truncate">
            {annotations.map((a) => a.title).join(', ')}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Palette for timespan annotation bars */
const TIMESPAN_COLORS = [
  'oklch(0.65 0.2 250)',   // blue
  'oklch(0.65 0.2 330)',   // pink
  'oklch(0.65 0.2 150)',   // green
  'oklch(0.65 0.2 50)',    // orange
  'oklch(0.65 0.2 290)',   // purple
  'oklch(0.65 0.2 190)',   // teal
]

/**
 * Single-row annotation display: dots for all annotations + colored line segments for timespans.
 * Timespan annotations appear in the popover of their start/end column dots.
 */
export function AnnotationHeaderRow({
  table,
  annotations,
  testDates,
  onEditAnnotation,
  onAddAnnotation,
}: {
  table: ReturnType<typeof useReactTable<GridRow>>
  annotations: Annotation[]
  testDates: { id: string; date: string; name: string }[]
  onEditAnnotation: (annotation: Annotation) => void
  onAddAnnotation: (date: string) => void
}) {
  // Compute timespan bar info (column index ranges + colors)
  const timespanBars = useMemo(() => {
    const timespans = annotations.filter((a) => a.end_date)
    if (timespans.length === 0 || testDates.length === 0) return []

    return timespans.map((ann, i) => {
      let startIdx = testDates.findIndex((td) => td.date >= ann.date)
      if (startIdx === -1) startIdx = testDates.length - 1

      let endIdx = -1
      for (let j = testDates.length - 1; j >= 0; j--) {
        if (testDates[j].date <= ann.end_date!) { endIdx = j; break }
      }
      if (endIdx === -1) endIdx = 0

      return { annotation: ann, startIdx, endIdx, color: TIMESPAN_COLORS[i % TIMESPAN_COLORS.length] }
    })
  }, [annotations, testDates])

  // Group ALL annotations by column (point annotations by their date,
  // timespan annotations by their start AND end date columns)
  const byColumnId = useMemo(() => {
    const map = new Map<string, Annotation[]>()
    const dateToColumnId = new Map<string, string>()
    for (const td of testDates) dateToColumnId.set(td.date, td.id)

    for (const a of annotations) {
      // Add to start date column
      const startColId = dateToColumnId.get(a.date)
      if (startColId) {
        const existing = map.get(startColId)
        if (existing) existing.push(a)
        else map.set(startColId, [a])
      }
      // For timespans, also add to end date column (if different)
      if (a.end_date && a.end_date !== a.date) {
        const endColId = dateToColumnId.get(a.end_date)
        if (endColId && endColId !== startColId) {
          const existing = map.get(endColId)
          if (existing) existing.push(a)
          else map.set(endColId, [a])
        }
      }
    }
    return map
  }, [annotations, testDates])

  const visibleColumns = table.getVisibleLeafColumns()

  // Compute column centers (relative to date area start) for SVG arc paths
  const { colCenters, dateAreaWidth, pinnedWidth: pWidth } = useMemo(() => {
    const centers: number[] = []
    let pinned = 0
    let dateOffset = 0
    for (const col of visibleColumns) {
      if (STATIC_COLUMN_IDS.has(col.id)) {
        pinned += col.getSize()
      } else {
        centers.push(dateOffset + col.getSize() / 2)
        dateOffset += col.getSize()
      }
    }
    return { colCenters: centers, dateAreaWidth: dateOffset, pinnedWidth: pinned }
  }, [visibleColumns])

  const ARC_DROP_BASE = 14
  const ARC_DROP_STEP = 12
  const DOT_PAD = 22 // vertical center of the dot area
  const lowestArc = timespanBars.length > 0 ? DOT_PAD + ARC_DROP_BASE + (timespanBars.length - 1) * ARC_DROP_STEP : 0
  const ROW_H = Math.max(44, lowestArc + 14) // 14px padding below lowest arc
  const DOT_Y = DOT_PAD

  // The row label goes in the first static column only.
  const labelColumnId = visibleColumns.find((c) => STATIC_COLUMN_IDS.has(c.id))?.id

  return (
    <tr style={{ display: 'flex', width: table.getTotalSize(), position: 'relative' }}>
      {visibleColumns.map((column) => {
        const isStatic = STATIC_COLUMN_IDS.has(column.id)

        if (isStatic) {
          const showLabel = column.id === labelColumnId
          return (
            <th
              key={`ann-${column.id}`}
              className="relative border-b px-4"
              style={{
                ...getColumnPinningStyles(column),
                flex: 'none',
                height: ROW_H,
                zIndex: column.getIsPinned() ? 11 : undefined,
                backgroundColor: 'var(--background)',
              }}
            >
              {showLabel && (
                <span
                  className="absolute text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                  style={{ top: DOT_Y, transform: 'translateY(-50%)', left: 16 }}
                >
                  Annotations
                </span>
              )}
            </th>
          )
        }

        const columnAnnotations = byColumnId.get(column.id)
        const td = testDates.find((t) => t.id === column.id)
        const testDate = td?.date

        return (
          <th
            key={`ann-${column.id}`}
            className="relative border-b"
            style={{
              ...getColumnPinningStyles(column),
              flex: 'none',
              height: ROW_H,
            }}
          >
            {columnAnnotations && columnAnnotations.length > 0 ? (
              <div
                className="absolute left-1/2 z-[2] -translate-x-1/2 -translate-y-1/2"
                style={{ top: DOT_Y }}
              >
                <AnnotationDotCell
                  annotations={columnAnnotations}
                  date={testDate ?? columnAnnotations[0].date}
                  onEdit={onEditAnnotation}
                  onAddNew={onAddAnnotation}
                />
              </div>
            ) : testDate ? (
              <button
                type="button"
                onClick={() => onAddAnnotation(testDate)}
                className="absolute left-1/2 z-[2] flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-colors hover:bg-accent"
                style={{ top: DOT_Y }}
                title={`Add annotation for ${testDate}`}
              >
                <span className="size-1.5 rounded-full border border-dashed border-muted-foreground/30" />
              </button>
            ) : null}
          </th>
        )
      })}

      {/* SVG overlay + tooltip overlays for timespan arcs */}
      {timespanBars.length > 0 && (
        <td style={{ width: 0, padding: 0, border: 'none', position: 'relative' }}>
          <svg
            className="absolute"
            style={{
              left: pWidth,
              top: 0,
              width: dateAreaWidth,
              height: ROW_H,
              overflow: 'visible',
              zIndex: 1,
              pointerEvents: 'none',
            }}
          >
            {timespanBars.map((bar, i) => {
              const x1 = colCenters[bar.startIdx] ?? 0
              const x2 = colCenters[bar.endIdx] ?? 0
              const botY = DOT_Y + ARC_DROP_BASE + i * ARC_DROP_STEP
              const curveW = 30

              const d = [
                `M ${x1} ${DOT_Y}`,
                `C ${x1} ${botY}, ${x1} ${botY}, ${x1 + curveW} ${botY}`,
                `L ${x2 - curveW} ${botY}`,
                `C ${x2} ${botY}, ${x2} ${botY}, ${x2} ${DOT_Y}`,
              ].join(' ')

              return (
                <g key={bar.annotation.id}>
                  <path d={d} fill="none" stroke="transparent" strokeWidth={14} style={{ pointerEvents: 'auto' }} />
                  <path
                    d={d}
                    fill="none"
                    stroke={bar.color}
                    strokeWidth={3}
                    strokeLinecap="round"
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              )
            })}
          </svg>
          {timespanBars.map((bar, i) => {
            const x1 = colCenters[bar.startIdx] ?? 0
            const x2 = colCenters[bar.endIdx] ?? 0
            const arcY = DOT_Y + ARC_DROP_BASE + i * ARC_DROP_STEP

            return (
              <div
                key={`ts-hover-${bar.annotation.id}`}
                className="absolute"
                style={{
                  left: pWidth + x1,
                  top: arcY - 7,
                  width: x2 - x1,
                  height: 14,
                  zIndex: 1,
                }}
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="size-full cursor-default" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={4}>
                      <span className="font-medium">{bar.annotation.title}</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )
          })}
        </td>
      )}
    </tr>
  )
}
