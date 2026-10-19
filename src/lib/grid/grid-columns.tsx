import { normalizeUnit } from '@/lib/grid/unit-conversion'
import { type ColumnDef } from '@tanstack/react-table'
import { Check, Sparkles } from 'lucide-react'
import Link from 'next/link'
import type { Biomarker, Sex } from '@/lib/database.types'
import type { GridRow } from './grid-types'
import type { RangeStatus } from './reference-range'
import { findReferenceRange } from './reference-range'
import { GridCell } from '@/components/grid/grid-cell'
import { APP_LOCALE } from '@/lib/locale'

export interface CellClickData {
  biomarker: Biomarker
  value: number
  unit: string
  testDate: string
  testName: string
  status: RangeStatus
  bloodTestId: string
  testResultId: string
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return new Intl.DateTimeFormat(APP_LOCALE, {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  }).format(date)
}

function formatRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return '—'
  if (low == null) return `< ${high}`
  if (high == null || high >= 999) return `> ${low}`
  return `${low}–${high}`
}

export function createGridColumns(
  testDates: { id: string; date: string; name: string }[],
  userSex?: Sex | null,
  onCellClick?: (data: CellClickData) => void,
  onFullTestInterpret?: (testId: string) => void,
  analyzedTestIds?: Set<string>,
  annotationOnlyIds?: Set<string>,
  unitPrefsMap?: Map<string, string>,
  onUnitChange?: (biomarkerId: string, unit: string) => void,
): ColumnDef<GridRow>[] {
  const rangeSex = userSex === 'male' || userSex === 'female' ? userSex : null

  return [
    // Pinned: short name
    {
      id: 'marker_name',
      header: 'Marker',
      accessorFn: (row) => row.biomarker.name,
      size: 110,
      minSize: 80,
      enablePinning: true,
      cell: ({ row }) => {
        const bm = row.original.biomarker
        const isVariant = !!bm.parent_id
        const isFirstVariant = row.original.isFirstVariant
        const isLastVariant = row.original.isLastVariant
        return (
          <div className="flex h-full w-full flex-col justify-center self-stretch">
            {/* Parent/component name as a small label on the first child only — at the left */}
            {isFirstVariant && row.original.parentName && (
              <div className="text-[10px] font-medium leading-none text-muted-foreground/50">
                <Link
                  href={`/biomarkers/${bm.parent_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:underline"
                >
                  {row.original.parentName}
                </Link>
              </div>
            )}
            <div className={`flex items-center font-medium ${isFirstVariant ? 'mt-0.5' : ''}`}>
              {/* Connector linking siblings: a short vertical that extends up/down to meet the
                  neighbouring variant's elbow (no segment above the first / below the last). */}
              {isVariant && (
                <span aria-hidden className="pointer-events-none relative mr-1.5 h-5 w-2 shrink-0">
                  {!isFirstVariant && <span className="absolute left-0 top-[-16px] bottom-1/2 w-px bg-border" />}
                  {!isLastVariant && <span className="absolute left-0 top-1/2 bottom-[-16px] w-px bg-border" />}
                  <span className="absolute left-0 top-1/2 h-px w-full bg-border" />
                </span>
              )}
              <Link
                href={`/biomarkers/${bm.id}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:underline"
              >
                {bm.short_name ?? bm.name}
              </Link>
            </div>
          </div>
        )
      },
    },
    // Pinned: full name
    {
      id: 'marker_fullname',
      header: 'Name',
      accessorFn: (row) => row.biomarker.name,
      size: 180,
      minSize: 120,
      enablePinning: true,
      cell: ({ row }) => (
        <span className="truncate text-xs text-muted-foreground">
          {row.original.biomarker.name}
        </span>
      ),
    },
    // Pinned: unit (selectable when multiple units available)
    {
      id: 'marker_unit',
      header: 'Unit',
      accessorFn: (row) => row.biomarker.unit,
      size: 95,
      minSize: 70,
      enablePinning: true,
      cell: ({ row }) => {
        const bmId = row.original.biomarker.id
        // biomarker.unit is already the display unit (set by displayRows)
        const displayUnit = row.original.biomarker.unit
        // Options: the catalogue unit, the marker's other units and the
        // current display unit, once each — so the select always shows the
        // unit the cells are actually in.
        const options: string[] = []
        for (const u of [row.original.catalogueUnit ?? displayUnit, ...(row.original.units ?? []).map((x) => x.unit), displayUnit]) {
          if (u && !options.some((o) => normalizeUnit(o) === normalizeUnit(u))) options.push(u)
        }
        const selected = options.find((o) => normalizeUnit(o) === normalizeUnit(displayUnit)) ?? displayUnit

        if (options.length <= 1 || !onUnitChange) {
          return (
            <span className="text-xs text-muted-foreground">
              {displayUnit}
            </span>
          )
        }

        return (
          <select
            value={selected}
            onChange={(e) => onUnitChange(bmId, e.target.value)}
            className="w-full cursor-pointer rounded border-none bg-transparent px-0 py-0 text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          >
            {options.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        )
      },
    },
    // Pinned: normal reference range
    {
      id: 'ref_normal',
      header: 'Normal',
      size: 85,
      minSize: 70,
      enablePinning: true,
      cell: ({ row }) => {
        const ranges = row.original.referenceRanges
        if (!ranges || ranges.length === 0) return <span className="text-xs text-muted-foreground/40">—</span>
        const r = findReferenceRange(ranges, row.original.biomarker.unit, rangeSex, null, 'normal')
        return (
          <span className="text-xs text-muted-foreground">
            {formatRange(r.low, r.high)}
          </span>
        )
      },
    },
    // Pinned: optimal reference range
    {
      id: 'ref_optimal',
      header: 'Optimal',
      size: 85,
      minSize: 70,
      enablePinning: true,
      cell: ({ row }) => {
        const ranges = row.original.referenceRanges
        if (!ranges || ranges.length === 0) return <span className="text-xs text-muted-foreground/40">—</span>
        const r = findReferenceRange(ranges, row.original.biomarker.unit, rangeSex, null, 'optimal')
        if (r.low == null && r.high == null) return <span className="text-xs text-muted-foreground/40">—</span>
        return (
          <span className="text-xs text-emerald-600">
            {formatRange(r.low, r.high)}
          </span>
        )
      },
    },
    // One column per test date
    ...testDates.map(
      (test): ColumnDef<GridRow> => {
        const isAnnotationOnly = annotationOnlyIds?.has(test.id) ?? false

        return {
          id: test.id,
          meta: isAnnotationOnly ? { annotationOnly: true } : undefined,
          header: () => {
            if (isAnnotationOnly) {
              return (
                <div className="flex w-full flex-col items-center gap-0.5">
                  <span className="text-xs font-medium">
                    {formatShortDate(test.date)}
                  </span>
                </div>
              )
            }
            const isAnalyzed = analyzedTestIds?.has(test.id) ?? false
            return (
              <div className="flex w-full flex-col items-center gap-0.5" title={test.name}>
                <span className="text-xs font-medium">
                  {formatShortDate(test.date)}
                </span>
                {onFullTestInterpret && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onFullTestInterpret(test.id)
                    }}
                    className={
                      isAnalyzed
                        ? 'flex w-full items-center justify-center gap-0.5 rounded border border-emerald-600 bg-emerald-600/10 px-1.5 py-0.5 text-[10px] text-emerald-600 transition-colors hover:bg-emerald-600/20'
                        : 'flex w-full items-center justify-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
                    }
                    title={isAnalyzed ? 'View AI analysis' : 'Generate AI analysis'}
                  >
                    {isAnalyzed ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    <span>AI</span>
                  </button>
                )}
              </div>
            )
          },
          size: 90,
          minSize: 70,
          cell: ({ row }) => {
            if (isAnnotationOnly) {
              return null
            }
            const data = row.original.values[test.id]
            if (!data)
              return (
                <div className="text-center text-muted-foreground">--</div>
              )
            return (
              <GridCell
                value={data.value}
                unit={data.unit}
                displayUnit={row.original.biomarker.unit}
                biomarker={row.original.biomarker}
                userSex={userSex}
                referenceRanges={row.original.referenceRanges}
                onClick={(status) => {
                  onCellClick?.({
                    biomarker: row.original.biomarker,
                    value: data.value,
                    unit: data.unit,
                    testDate: test.date,
                    testName: test.name,
                    status,
                    bloodTestId: test.id,
                    testResultId: data.resultId,
                  })
                }}
              />
            )
          },
        }
      }
    ),
  ]
}
