'use client'

import dynamic from 'next/dynamic'
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type FilterFn,
  type VisibilityState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { toast } from 'sonner'
import type { Annotation, Profile, Sex, Supplement } from '@/lib/database.types'
import type { GridRow, GridData } from '@/lib/grid/grid-types'
import {
  createGridColumns,
  type CellClickData,
} from '@/lib/grid/grid-columns'
import { findReferenceRange, getRangeStatus, getRangeStatusFromRanges, type RangeStatus } from '@/lib/grid/reference-range'
import { normalizeUnit } from '@/lib/grid/unit-conversion'
import {
  convertRowsToDisplayUnits,
  filterRowsByCategoryAndStatus,
  filterTestDatesByRange,
  mergeAnnotationDateColumns,
} from '@/lib/grid/display-rows'
import { setUnitPreference } from '@/actions/unit-preferences'
import { hashProfile, hashMarkerContext } from '@/lib/interpretation/cache'
import type {
  InterpretationRequest,
  MarkerContext,
  ProfileContext,
} from '@/lib/interpretation/types'
import { useGridFilters } from '@/hooks/use-grid-filters'
import { useInterpretation } from '@/hooks/use-interpretation'
import { useChat } from '@/hooks/use-chat'
import { exportGridAsCsv } from '@/lib/export/export-csv'
import { buildTrendData, type TrendData } from '@/lib/analytics/marker-trends'
import { computeMarkerChanges } from '@/lib/analytics/marker-changes'
import type { CellDetailData } from './cell-detail-modal'
import { GridToolbar } from './grid-toolbar'
import { MarkerChangesBanner } from '@/components/analytics/marker-changes'
import { getAnnotations } from '@/actions/annotations'
import { AnnotationEditor } from '@/components/annotations/annotation-editor'
import { AnnotationHeaderRow } from './annotation-header-row'
import { getColumnPinningStyles } from './grid-layout'
import { SupplementHeaderRow } from './supplement-header-row'

interface MarkerGridProps {
  rows: GridRow[]
  testDates: GridData['testDates']
  categories: string[]
  userSex?: Sex | null
  profile?: Profile | null
  analyzedTestIds?: string[]
  annotations?: Annotation[]
  supplements?: Supplement[]
  unitPreferences?: [string, string][]
}

/**
 * Global filter that searches across biomarker name, short_name, and aliases.
 */
const markerSearchFilter: FilterFn<GridRow> = (row, _columnId, filterValue: string) => {
  if (!filterValue) return true
  const term = filterValue.toLowerCase()
  const bm = row.original.biomarker
  if (bm.name.toLowerCase().includes(term)) return true
  if (bm.short_name?.toLowerCase().includes(term)) return true
  if (bm.aliases?.some((alias) => alias.toLowerCase().includes(term))) return true
  return false
}

// Opened on demand: keep recharts (cell modal) and react-markdown
// (interpretation panel) out of the grid's first load.
const CellDetailModal = dynamic(() => import('./cell-detail-modal').then((m) => m.CellDetailModal))
const InterpretationPanel = dynamic(() =>
  import('@/components/interpretation/interpretation-panel').then((m) => m.InterpretationPanel)
)

/** Shared empty set, so hiding annotations does not change the column memo's inputs every render. */
const NO_ANNOTATION_ONLY_IDS = new Set<string>()

export function MarkerGrid({
  rows,
  testDates,
  categories,
  userSex,
  profile,
  analyzedTestIds: analyzedTestIdsProp,
  annotations: annotationsProp,
  supplements: supplementsProp,
  unitPreferences: unitPrefsProp,
}: MarkerGridProps) {
  const [analyzedTestIds, setAnalyzedTestIds] = useState(
    () => new Set(analyzedTestIdsProp ?? [])
  )
  const [unitPrefsMap, setUnitPrefsMap] = useState(
    () => new Map(unitPrefsProp ?? [])
  )

  const handleUnitChange = useCallback((biomarkerId: string, unit: string) => {
    setUnitPrefsMap((prev) => {
      const next = new Map(prev)
      next.set(biomarkerId, unit)
      return next
    })
    // Save in background
    setUnitPreference(biomarkerId, unit)
  }, [])
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [selectedCell, setSelectedCell] = useState<CellDetailData | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const filterActions = useGridFilters()
  const { filters } = filterActions

  // Annotation state — hidden by default (toggle on via View → Toggle columns)
  const [showAnnotations, setShowAnnotations] = useState(false)
  const [localAnnotations, setLocalAnnotations] = useState<Annotation[]>(annotationsProp ?? [])
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null)
  const [editorDefaultDate, setEditorDefaultDate] = useState<string | null>(null)

  // Supplement state — hidden by default (toggle on via View → Toggle columns)
  const [showSupplements, setShowSupplements] = useState(false)
  const [localSupplements, setLocalSupplements] = useState<Supplement[]>(supplementsProp ?? [])

  // Sync prop changes (e.g. after server revalidation)
  useEffect(() => {
    if (annotationsProp) setLocalAnnotations(annotationsProp)
  }, [annotationsProp])

  useEffect(() => {
    if (supplementsProp) setLocalSupplements(supplementsProp)
  }, [supplementsProp])

  const handleEditAnnotation = useCallback((annotation: Annotation) => {
    setEditingAnnotation(annotation)
    setEditorDefaultDate(null)
    setEditorOpen(true)
  }, [])

  const handleAddAnnotation = useCallback((date: string) => {
    setEditingAnnotation(null)
    setEditorDefaultDate(date)
    setEditorOpen(true)
  }, [])

  const handleAddAnnotationFromToolbar = useCallback(() => {
    setEditingAnnotation(null)
    setEditorDefaultDate(null)
    setEditorOpen(true)
  }, [])

  const refreshAnnotations = useCallback(() => {
    setEditorOpen(false)
    setEditingAnnotation(null)
    setEditorDefaultDate(null)
    startTransition(async () => {
      const result = await getAnnotations()
      if (result.data) {
        setLocalAnnotations(result.data)
      }
    })
  }, [])

  // Interpretation state
  const interpretation = useInterpretation()
  // The hook object is new on every render; its functions are stable. Depend
  // on the functions so the column memo below does not rebuild per render.
  const { interpret, reset: resetInterpretation } = interpretation
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTitle, setPanelTitle] = useState('')
  const [panelSubtitle, setPanelSubtitle] = useState<string | undefined>()

  // Chat state -- track context for the current interpretation
  const [chatContext, setChatContext] = useState<{
    allTestResults: MarkerContext[]
    profile: ProfileContext
    markerName?: string
  }>({ allTestResults: [], profile: {} })

  const chat = useChat({
    allTestResults: chatContext.allTestResults,
    profile: chatContext.profile,
    markerName: chatContext.markerName,
    initialInterpretation: interpretation.content || undefined,
  })
  const resetChat = chat.reset

  // Track current cell click data for interpretation request building
  const lastCellClickRef = useRef<CellClickData | null>(null)

  // Track the test ID being interpreted so we can mark it analyzed when done
  const interpretingTestIdRef = useRef<string | null>(null)
  const prevIsStreamingRef = useRef(false)

  useEffect(() => {
    // When interpretation finishes (streaming done or cache loaded), mark test as analyzed
    const wasActive = prevIsStreamingRef.current || interpretation.isLoading
    const isNowIdle = !interpretation.isStreaming && !interpretation.isLoading
    if (wasActive && isNowIdle && interpretation.content && interpretingTestIdRef.current) {
      setAnalyzedTestIds((prev) => new Set(prev).add(interpretingTestIdRef.current!))
      interpretingTestIdRef.current = null
    }
    prevIsStreamingRef.current = interpretation.isStreaming
  }, [interpretation.isStreaming, interpretation.isLoading, interpretation.content])

  // Trend data for the currently selected cell
  const [selectedTrendData, setSelectedTrendData] = useState<TrendData | null>(null)

  // Marker changes comparing the two most recent tests
  const markerChanges = useMemo(() => {
    if (testDates.length < 2) return []
    const currentTestId = testDates[testDates.length - 1].id
    const previousTestId = testDates[testDates.length - 2].id
    return computeMarkerChanges(rows, currentTestId, previousTestId, userSex)
  }, [rows, testDates, userSex])

  const handleCellClick = useCallback((data: CellClickData) => {
    const { biomarker, value, unit, testDate, testName, status, bloodTestId } = data
    lastCellClickRef.current = data

    // Find reference range -- check if we have enriched data
    const row = rows.find(r => r.biomarker.id === biomarker.id)
    let refLow: number | null = null
    let refHigh: number | null = null

    // `unit` is the cell's ACTUAL unit (converted display unit, or the
    // original when un-convertible) — match ranges against it, never against
    // the marker's default unit, and only trust inline fields in that unit.
    if (row?.referenceRanges && row.referenceRanges.length > 0) {
      const rangeSex = userSex === 'male' || userSex === 'female' ? userSex : null
      const range = findReferenceRange(row.referenceRanges, unit, rangeSex)
      refLow = range.low
      refHigh = range.high
    } else if (normalizeUnit(unit) === normalizeUnit(biomarker.unit)) {
      // Fallback to inline fields
      refLow = biomarker.ref_range_low
      refHigh = biomarker.ref_range_high
      if (userSex === 'male' && biomarker.ref_range_low_male != null) {
        refLow = biomarker.ref_range_low_male
        refHigh = biomarker.ref_range_high_male
      } else if (userSex === 'female' && biomarker.ref_range_low_female != null) {
        refLow = biomarker.ref_range_low_female
        refHigh = biomarker.ref_range_high_female
      }
    }

    setSelectedCell({
      markerName: biomarker.short_name ?? biomarker.name,
      value,
      unit,
      testDate,
      testName,
      status,
      refRangeLow: refLow,
      refRangeHigh: refHigh,
      biomarkerDescription: biomarker.description,
      biomarkerId: biomarker.id,
      bloodTestId,
    })

    // Compute trend data for this marker
    if (row) {
      const rangeSex = userSex === 'male' || userSex === 'female' ? userSex : null
      setSelectedTrendData(buildTrendData(row, testDates, rangeSex))
    } else {
      setSelectedTrendData(null)
    }

    setModalOpen(true)
  }, [rows, userSex, testDates])

  /**
   * Build all test results for the given blood test from grid rows.
   */
  const buildAllTestResults = useCallback(
    (bloodTestId: string): MarkerContext[] => {
      const results: MarkerContext[] = []
      const rangeSex = userSex === 'male' || userSex === 'female' ? userSex : null

      for (const row of rows) {
        const cellData = row.values[bloodTestId]
        if (!cellData) continue

        // Use new ranges if available
        let refLow: number | null = null
        let refHigh: number | null = null
        let status: RangeStatus

        if (row.referenceRanges && row.referenceRanges.length > 0) {
          // Match the range by the CELL's own unit — never judge a value
          // stored in mmol/L against a mg/dL range (mirrors GridCell).
          const range = findReferenceRange(row.referenceRanges, cellData.unit, rangeSex)
          refLow = range.low
          refHigh = range.high
          status = getRangeStatusFromRanges(cellData.value, row.referenceRanges, cellData.unit, rangeSex)
        } else if (normalizeUnit(cellData.unit) === normalizeUnit(row.biomarker.unit)) {
          // Fallback to inline fields — only when their unit matches the cell's.
          refLow = row.biomarker.ref_range_low
          refHigh = row.biomarker.ref_range_high
          if (userSex === 'male' && row.biomarker.ref_range_low_male != null) {
            refLow = row.biomarker.ref_range_low_male
            refHigh = row.biomarker.ref_range_high_male
          } else if (userSex === 'female' && row.biomarker.ref_range_low_female != null) {
            refLow = row.biomarker.ref_range_low_female
            refHigh = row.biomarker.ref_range_high_female
          }
          status = getRangeStatus(cellData.value, row.biomarker, userSex)
        } else {
          // Cell unit differs from the inline fields' unit — can't judge.
          status = 'unknown'
        }

        results.push({
          name: row.biomarker.name,
          shortName: row.biomarker.short_name,
          value: cellData.value,
          unit: cellData.unit,
          category: row.biomarker.category,
          refRangeLow: refLow,
          refRangeHigh: refHigh,
          status,
        })
      }
      return results
    },
    [rows, userSex]
  )

  const handleInterpret = useCallback(() => {
    const cell = lastCellClickRef.current
    if (!cell) return

    const allTestResults = buildAllTestResults(cell.bloodTestId)

    // Build profile context
    const profileContext: ProfileContext = {
      dateOfBirth: profile?.date_of_birth ?? null,
      sex: profile?.sex ?? null,
      heightCm: profile?.height_cm ?? null,
      weightKg: profile?.weight_kg ?? null,
      activityLevel: profile?.activity_level ?? null,
    }

    // Determine reference range for focused marker — match by the cell's
    // ACTUAL unit (cell.unit), and only trust inline fields in that unit.
    const focusedRow = rows.find(r => r.biomarker.id === cell.biomarker.id)
    let refLow: number | null = null
    let refHigh: number | null = null
    const rangeSex = userSex === 'male' || userSex === 'female' ? userSex : null

    if (focusedRow?.referenceRanges && focusedRow.referenceRanges.length > 0) {
      const range = findReferenceRange(focusedRow.referenceRanges, cell.unit, rangeSex)
      refLow = range.low
      refHigh = range.high
    } else if (normalizeUnit(cell.unit) === normalizeUnit(cell.biomarker.unit)) {
      refLow = cell.biomarker.ref_range_low
      refHigh = cell.biomarker.ref_range_high
      if (userSex === 'male' && cell.biomarker.ref_range_low_male != null) {
        refLow = cell.biomarker.ref_range_low_male
        refHigh = cell.biomarker.ref_range_high_male
      } else if (userSex === 'female' && cell.biomarker.ref_range_low_female != null) {
        refLow = cell.biomarker.ref_range_low_female
        refHigh = cell.biomarker.ref_range_high_female
      }
    }

    const request: InterpretationRequest = {
      type: 'single_marker',
      userId: profile?.id ?? '',
      bloodTestId: cell.bloodTestId,
      testResultId: cell.testResultId,
      markerName: cell.biomarker.name,
      markerValue: cell.value,
      markerUnit: cell.unit,
      refRangeLow: refLow,
      refRangeHigh: refHigh,
      status: cell.status,
      allTestResults,
      profile: profileContext,
    }

    const profileHash = hashProfile(profileContext)
    const markerContextHash = hashMarkerContext(allTestResults)

    // Close detail modal, open interpretation panel
    setModalOpen(false)
    setPanelTitle(cell.biomarker.short_name ?? cell.biomarker.name)
    setPanelSubtitle(`${cell.testName} - ${cell.testDate}`)
    setPanelOpen(true)

    // Reset chat and set context for new interpretation
    resetChat()
    setChatContext({
      allTestResults,
      profile: profileContext,
      markerName: cell.biomarker.name,
    })

    interpret(request, profileHash, markerContextHash)
  }, [buildAllTestResults, profile, userSex, rows, interpret, resetChat])

  const handleFullTestInterpret = useCallback(
    (testId: string) => {
      const test = testDates.find((t) => t.id === testId)
      if (!test) return

      const allTestResults = buildAllTestResults(testId)
      if (allTestResults.length === 0) return

      const profileContext: ProfileContext = {
        dateOfBirth: profile?.date_of_birth ?? null,
        sex: profile?.sex ?? null,
        heightCm: profile?.height_cm ?? null,
        weightKg: profile?.weight_kg ?? null,
        activityLevel: profile?.activity_level ?? null,
      }

      const request: InterpretationRequest = {
        type: 'full_test',
        userId: profile?.id ?? '',
        bloodTestId: testId,
        markerName: test.name,
        allTestResults,
        profile: profileContext,
      }

      const profileHash = hashProfile(profileContext)
      const markerContextHash = hashMarkerContext(allTestResults)

      interpretingTestIdRef.current = testId

      setPanelTitle(test.name)
      setPanelSubtitle(test.date)
      setPanelOpen(true)

      // Reset chat and set context for new interpretation
      resetChat()
      setChatContext({
        allTestResults,
        profile: profileContext,
        markerName: test.name,
      })

      interpret(request, profileHash, markerContextHash)
    },
    [testDates, buildAllTestResults, profile, interpret, resetChat]
  )

  const handlePanelOpenChange = useCallback(
    (open: boolean) => {
      setPanelOpen(open)
      if (!open) {
        resetInterpretation()
        resetChat()
      }
    },
    [resetInterpretation, resetChat]
  )

  // Filter test date columns by date range
  const filteredTestDates = useMemo(
    () => filterTestDatesByRange(testDates, filters.dateFrom, filters.dateTo),
    [testDates, filters.dateFrom, filters.dateTo]
  )

  // Merge annotation-only dates as extra columns, sorted chronologically
  const { mergedDateColumns, annotationOnlyIds } = useMemo(
    () => mergeAnnotationDateColumns(filteredTestDates, localAnnotations),
    [filteredTestDates, localAnnotations]
  )

  // Filter rows by category and status before passing to the table
  const filteredRows = useMemo(
    () =>
      filterRowsByCategoryAndStatus(rows, {
        categories: filters.categories,
        status: filters.status,
        testDates: filteredTestDates,
        userSex,
      }),
    [rows, filters.categories, filters.status, filteredTestDates, userSex]
  )

  // Apply unit conversions: display in user's preferred unit or most recent lab unit
  const displayRows = useMemo(
    () => convertRowsToDisplayUnits(filteredRows, unitPrefsMap, filteredTestDates),
    [filteredRows, unitPrefsMap, filteredTestDates]
  )

  // Responsive: detect mobile for column pinning and visibility
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  )

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    setIsMobile(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const activeDateColumns = showAnnotations ? mergedDateColumns : filteredTestDates
  const activeAnnotationOnlyIds = showAnnotations ? annotationOnlyIds : NO_ANNOTATION_ONLY_IDS

  const columns = useMemo(
    () => createGridColumns(activeDateColumns, userSex, handleCellClick, handleFullTestInterpret, analyzedTestIds, activeAnnotationOnlyIds, unitPrefsMap, handleUnitChange),
    [activeDateColumns, userSex, handleCellClick, handleFullTestInterpret, analyzedTestIds, activeAnnotationOnlyIds, unitPrefsMap, handleUnitChange]
  )

  // Persist column visibility in localStorage
  const COLUMN_VISIBILITY_KEY = 'grid_column_visibility'
  const DEFAULT_VISIBILITY: VisibilityState = {
    ref_normal: false,
    ref_optimal: false,
  }
  const MOBILE_DEFAULT_VISIBILITY: VisibilityState = {
    ref_normal: false,
    ref_optimal: false,
    marker_fullname: false,
  }
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const defaults = typeof window !== 'undefined' && window.innerWidth < 640
      ? MOBILE_DEFAULT_VISIBILITY
      : DEFAULT_VISIBILITY
    if (typeof window === 'undefined') return defaults
    try {
      const stored = localStorage.getItem(COLUMN_VISIBILITY_KEY)
      return stored ? (JSON.parse(stored) as VisibilityState) : defaults
    } catch {
      return defaults
    }
  })

  useEffect(() => {
    localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility))
  }, [columnVisibility])

  // On mobile: only pin Marker and Unit so date columns have room
  const columnPinning = useMemo(() => ({
    left: isMobile
      ? ['marker_name']
      : ['marker_name', 'marker_fullname', 'marker_unit', 'ref_normal', 'ref_optimal'],
  }), [isMobile])

  const table = useReactTable({
    data: displayRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: markerSearchFilter,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      globalFilter: filters.search ?? '',
      columnVisibility,
      columnPinning,
    },
  })

  const handleExportCsv = useCallback(() => {
    const visibleRows = table.getFilteredRowModel().rows.map((r) => r.original)
    exportGridAsCsv({ rows: visibleRows, testDates: filteredTestDates })
  }, [table, filteredTestDates])

  const exportingPdfRef = useRef(false)
  const handleExportPdf = useCallback(async () => {
    // One export at a time: a second click while jsPDF loads would make a
    // second identical PDF.
    if (exportingPdfRef.current) return
    exportingPdfRef.current = true
    try {
      const visibleRows = table.getFilteredRowModel().rows.map((r) => r.original)
      // jsPDF is only needed for this button, so load it on click.
      const { exportGridAsPdf } = await import('@/lib/export/export-pdf')
      exportGridAsPdf({ rows: visibleRows, testDates: filteredTestDates }, userSex)
    } catch {
      toast.error('Could not create the PDF. Please reload the page and try again.')
    } finally {
      exportingPdfRef.current = false
    }
  }, [table, filteredTestDates, userSex])

  const { rows: tableRows } = table.getRowModel()

  // Build display items: interleave category/parent headers with data rows
  type DisplayItem =
    | { type: 'category'; label: string; key: string }
    | { type: 'data'; rowIndex: number; key: string }

  const displayItems: DisplayItem[] = useMemo(() => {
    const items: DisplayItem[] = []
    for (let i = 0; i < tableRows.length; i++) {
      const row = tableRows[i].original
      const prevRow = i > 0 ? tableRows[i - 1].original : null

      // Category header row
      if (i === 0 || row.category !== prevRow?.category) {
        items.push({ type: 'category', label: row.category, key: `cat-${row.category}-${i}` })
      }

      items.push({ type: 'data', rowIndex: i, key: tableRows[i].id })
    }
    return items
  }, [tableRows])

  const rowVirtualizer = useVirtualizer({
    count: displayItems.length,
    estimateSize: () => 40,
    getScrollElement: () => scrollContainerRef.current,
    overscan: 10,
  })

  return (
    <>
      {markerChanges.length > 0 && (
        <MarkerChangesBanner changes={markerChanges} />
      )}

      <GridToolbar
        categories={categories}
        filterActions={filterActions}
        table={table}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        onAddAnnotation={handleAddAnnotationFromToolbar}
        showAnnotations={showAnnotations}
        onToggleAnnotations={setShowAnnotations}
        showSupplements={showSupplements}
        onToggleSupplements={setShowSupplements}
      />

      {/* flex-1/min-h-0 (page is a viewport-height flex column) makes this the
          single vertical scroller — no hardcoded 100vh offset, no nested page
          scroll on mobile. overscroll-contain stops iOS scroll chaining. */}
      <div
        ref={scrollContainerRef}
        className="relative mt-3 min-h-0 flex-1 overscroll-contain overflow-auto rounded-md border"
      >
        {/* display:grid on table/thead/tbody (TanStack virtual pattern): WebKit
            ignores position:relative on a table-row-group tbody, which anchored
            the absolutely-positioned virtual rows to the scroll container and
            shoved them under the sticky header on iOS. Rows are display:flex
            with explicit widths, so table layout isn't used anyway. */}
        <table
          className="border-collapse"
          style={{ display: 'grid', width: table.getTotalSize() }}
        >
          <thead className="sticky top-0 z-10 bg-background" style={{ display: 'grid' }}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} style={{ display: 'flex', width: table.getTotalSize() }}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap border-b px-4 py-2 text-left text-sm font-medium"
                    style={{
                      ...getColumnPinningStyles(header.column),
                      flex: 'none',
                      zIndex: header.column.getIsPinned() ? 11 : undefined,
                      backgroundColor: 'var(--background)',
                    }}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </th>
                ))}
              </tr>
            ))}
            {/* Annotation row inside thead for proper column alignment */}
            {showAnnotations && activeDateColumns.length > 0 && (
              <AnnotationHeaderRow
                table={table}
                annotations={localAnnotations}
                testDates={activeDateColumns}
                onEditAnnotation={handleEditAnnotation}
                onAddAnnotation={handleAddAnnotation}
              />
            )}
            {/* Supplement row below annotations */}
            {showSupplements && localSupplements.length > 0 && (
              <SupplementHeaderRow
                table={table}
                supplements={localSupplements}
                testDates={activeDateColumns}
              />
            )}
          </thead>
          <tbody
            style={{
              display: 'grid',
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: 'relative',
            }}
          >
            {tableRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No markers match your filters.
                </td>
              </tr>
            )}
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = displayItems[virtualRow.index]

              // Category header row
              if (item.type === 'category') {
                const visibleCols = table.getVisibleLeafColumns()
                let categoryLabelRendered = false

                return (
                  <tr
                    key={item.key}
                    data-index={virtualRow.index}
                    ref={(node) => rowVirtualizer.measureElement(node)}
                    style={{
                      display: 'flex',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: table.getTotalSize(),
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {visibleCols.map((col) => {
                      const isAnn = (col.columnDef.meta as Record<string, unknown>)?.annotationOnly
                      const showLabel = !categoryLabelRendered
                      if (showLabel) categoryLabelRendered = true
                      return (
                        <td
                          key={`cat-${col.id}`}
                          className={`py-1.5 ${isAnn ? '' : 'border-b'} ${showLabel ? 'px-4' : ''}`}
                          style={{
                            ...getColumnPinningStyles(col, 'color-mix(in oklch, var(--muted) 50%, transparent)'),
                            flex: 'none',
                          }}
                        >
                          {showLabel && (
                            <span
                              className="inline-block whitespace-nowrap text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                              style={{ position: 'sticky', left: 16 }}
                            >
                              {item.label}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              }

              // Data row
              const row = tableRows[item.rowIndex]
              return (
                <tr
                  key={item.key}
                  data-index={virtualRow.index}
                  ref={(node) => rowVirtualizer.measureElement(node)}
                  style={{
                    display: 'flex',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: table.getTotalSize(),
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isAnnOnly = (cell.column.columnDef.meta as Record<string, unknown>)?.annotationOnly
                    return (
                    <td
                      key={cell.id}
                      className={`flex items-center px-4 py-1.5 text-sm ${isAnnOnly ? '' : 'border-b'}`}
                      style={{
                        ...getColumnPinningStyles(cell.column, isAnnOnly ? 'color-mix(in oklch, var(--muted) 50%, transparent)' : undefined),
                        flex: 'none',
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <CellDetailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        data={selectedCell}
        trendData={selectedTrendData}
        onInterpret={handleInterpret}
        isInterpretLoading={interpretation.isLoading || interpretation.isStreaming}
      />

      <AnnotationEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        annotation={editingAnnotation}
        defaultDate={editorDefaultDate ?? undefined}
        onSaved={refreshAnnotations}
        onDeleted={refreshAnnotations}
      />

      <InterpretationPanel
        open={panelOpen}
        onOpenChange={handlePanelOpenChange}
        title={panelTitle}
        subtitle={panelSubtitle}
        content={interpretation.content}
        isStreaming={interpretation.isStreaming}
        isLoading={interpretation.isLoading}
        error={interpretation.error}
        cachedAt={interpretation.cachedAt}
        isStale={interpretation.isStale}
        onRegenerate={interpretation.regenerate}
        onAbort={interpretation.abort}
        chatMessages={chat.messages}
        isChatStreaming={chat.isStreaming}
        chatError={chat.error}
        onSendChatMessage={chat.sendMessage}
        onAbortChat={chat.abort}
      />
    </>
  )
}
