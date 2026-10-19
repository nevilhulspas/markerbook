'use client'

import { useMemo } from 'react'
import type { useReactTable } from '@tanstack/react-table'

import type { Supplement } from '@/lib/database.types'
import type { GridRow } from '@/lib/grid/grid-types'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getColumnPinningStyles, STATIC_COLUMN_IDS } from './grid-layout'

/** Palette for supplement period bars (distinct from annotation TIMESPAN_COLORS) */
const SUPPLEMENT_COLORS = [
  'oklch(0.7 0.15 140)',   // sage green
  'oklch(0.7 0.15 220)',   // soft blue
  'oklch(0.7 0.15 30)',    // warm amber
  'oklch(0.7 0.15 310)',   // soft violet
  'oklch(0.7 0.15 170)',   // mint
  'oklch(0.7 0.15 70)',    // gold
]

const SUPPLEMENT_BAR_HEIGHT = 16
const SUPPLEMENT_BAR_GAP = 4

/**
 * Supplement period bars rendered as colored horizontal lines spanning active periods.
 * Visually distinct from annotation arcs (straight lines with rounded ends).
 */
export function SupplementHeaderRow({
  table,
  supplements,
  testDates,
}: {
  table: ReturnType<typeof useReactTable<GridRow>>
  supplements: Supplement[]
  testDates: { id: string; date: string; name: string }[]
}) {
  const visibleColumns = table.getVisibleLeafColumns()

  // Compute column edges and centers for SVG positioning (same approach as AnnotationHeaderRow)
  const { colCenters, colEdges, dateAreaWidth, pinnedWidth: pWidth } = useMemo(() => {
    const centers: number[] = []
    const edges: { left: number; right: number }[] = []
    let pinned = 0
    let dateOffset = 0
    for (const col of visibleColumns) {
      if (STATIC_COLUMN_IDS.has(col.id)) {
        pinned += col.getSize()
      } else {
        const left = dateOffset
        const right = dateOffset + col.getSize()
        centers.push(dateOffset + col.getSize() / 2)
        edges.push({ left, right })
        dateOffset += col.getSize()
      }
    }
    return { colCenters: centers, colEdges: edges, dateAreaWidth: dateOffset, pinnedWidth: pinned }
  }, [visibleColumns])

  // For each supplement, compute start and end column indices
  const supplementBars = useMemo(() => {
    if (supplements.length === 0 || testDates.length === 0) return []

    return supplements.map((supp, i) => {
      // Find the first column where date >= start_date, or last if all are before
      let startIdx = testDates.findIndex((td) => td.date >= supp.start_date)
      if (startIdx === -1) startIdx = testDates.length - 1

      let endIdx: number
      if (!supp.end_date) {
        // Active supplement: extend to last column
        endIdx = testDates.length - 1
      } else {
        // Find last column where date <= end_date
        endIdx = -1
        for (let j = testDates.length - 1; j >= 0; j--) {
          if (testDates[j].date <= supp.end_date) { endIdx = j; break }
        }
        if (endIdx === -1) endIdx = 0
      }

      return {
        supplement: supp,
        startIdx,
        endIdx,
        color: SUPPLEMENT_COLORS[i % SUPPLEMENT_COLORS.length],
      }
    })
  }, [supplements, testDates])

  const PADDING_TOP = 8
  const ROW_H = Math.max(32, PADDING_TOP + supplementBars.length * (SUPPLEMENT_BAR_HEIGHT + SUPPLEMENT_BAR_GAP))

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
              key={`supp-${column.id}`}
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
                  style={{ top: PADDING_TOP + (SUPPLEMENT_BAR_HEIGHT / 2), transform: 'translateY(-50%)', left: 16 }}
                >
                  Supplements
                </span>
              )}
            </th>
          )
        }

        return (
          <th
            key={`supp-${column.id}`}
            className="relative border-b"
            style={{
              ...getColumnPinningStyles(column),
              flex: 'none',
              height: ROW_H,
            }}
          />
        )
      })}

      {/* SVG overlay + tooltip overlays for supplement bars */}
      {supplementBars.length > 0 && (
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
            {supplementBars.map((bar, i) => {
              const x1 = colEdges[bar.startIdx]?.left ?? colCenters[bar.startIdx] ?? 0
              const x2 = colEdges[bar.endIdx]?.right ?? colCenters[bar.endIdx] ?? 0
              const barY = PADDING_TOP + i * (SUPPLEMENT_BAR_HEIGHT + SUPPLEMENT_BAR_GAP) + SUPPLEMENT_BAR_HEIGHT / 2
              const barWidth = Math.max(x2 - x1, 4)

              return (
                <g key={bar.supplement.id}>
                  <line
                    x1={x1 + 2}
                    y1={barY}
                    x2={x1 + barWidth - 2}
                    y2={barY}
                    stroke="transparent"
                    strokeWidth={SUPPLEMENT_BAR_HEIGHT}
                    strokeLinecap="round"
                    style={{ pointerEvents: 'auto' }}
                  />
                  <rect
                    x={x1 + 2}
                    y={barY - SUPPLEMENT_BAR_HEIGHT / 2 + 2}
                    width={barWidth - 4}
                    height={SUPPLEMENT_BAR_HEIGHT - 4}
                    rx={4}
                    ry={4}
                    fill={bar.color}
                    opacity={0.7}
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              )
            })}
          </svg>
          {supplementBars.map((bar, i) => {
            const x1 = colEdges[bar.startIdx]?.left ?? colCenters[bar.startIdx] ?? 0
            const x2 = colEdges[bar.endIdx]?.right ?? colCenters[bar.endIdx] ?? 0
            const barY = PADDING_TOP + i * (SUPPLEMENT_BAR_HEIGHT + SUPPLEMENT_BAR_GAP)
            const barWidth = Math.max(x2 - x1, 4)

            return (
              <div
                key={`supp-hover-${bar.supplement.id}`}
                className="absolute"
                style={{
                  left: pWidth + x1,
                  top: barY,
                  width: barWidth,
                  height: SUPPLEMENT_BAR_HEIGHT,
                  zIndex: 1,
                }}
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="size-full cursor-default" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={4}>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{bar.supplement.name}</span>
                        {(bar.supplement.dose || bar.supplement.frequency) && (
                          <span className="text-xs text-muted-foreground">
                            {[bar.supplement.dose, bar.supplement.frequency].filter(Boolean).join(' - ')}
                          </span>
                        )}
                      </div>
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
