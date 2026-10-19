import type {
  Biomarker,
  BiomarkerUnit,
  Panel,
  ReferenceRange,
  Sex,
  System,
} from '@/lib/database.types'
import type { GridData, GridRow, PanelSystemLookup } from './grid-types'

export interface TestWithResults {
  id: string
  name: string
  test_date: string
  sample_type: string
  test_results: {
    id: string
    value: number
    unit: string
    biomarkers: Biomarker | null
  }[]
}

/** Optional enrichment data for biomarker units and reference ranges */
export type GridEnrichment = Map<
  string,
  { units: BiomarkerUnit[]; ranges: ReferenceRange[] }
>

export function buildGridData(
  tests: TestWithResults[],
  _userSex?: Sex | null,
  enrichment?: GridEnrichment,
  allBiomarkers?: Map<string, Biomarker>,
  panelLookup?: PanelSystemLookup
): GridData {
  // Test dates sorted ascending (oldest first = leftmost column)
  const testDates = tests.map((t) => ({
    id: t.id,
    date: t.test_date,
    name: t.name,
  }))

  // Collect all unique biomarkers across all tests
  const biomarkerMap = new Map<string, Biomarker>()
  const rowData = new Map<
    string,
    Record<string, { value: number; unit: string; resultId: string }>
  >()

  for (const test of tests) {
    for (const result of test.test_results) {
      const bm = result.biomarkers
      if (!bm) continue
      biomarkerMap.set(bm.id, bm)

      if (!rowData.has(bm.id)) rowData.set(bm.id, {})
      rowData.get(bm.id)![test.id] = {
        value: result.value,
        unit: result.unit,
        resultId: result.id,
      }
    }
  }

  /** Resolve panel metadata for a biomarker (check own panel_id, then parent's) */
  function getPanelData(bm: Biomarker): { panel: Panel & { system: System }; panelName: string; systemName: string; systemOrder: number; panelOrder: number } | null {
    if (!panelLookup) return null
    const panelId = bm.panel_id ?? (bm.parent_id ? allBiomarkers?.get(bm.parent_id)?.panel_id : null)
    if (!panelId) return null
    const panel = panelLookup.panels.get(panelId)
    if (!panel) return null
    return {
      panel,
      panelName: panel.name,
      systemName: panel.system.name,
      systemOrder: panel.system.display_order,
      panelOrder: panel.display_order,
    }
  }

  // Sort: group by system → panel → parent group → variant
  const sorted = Array.from(biomarkerMap.values()).sort((a, b) => {
    const aPd = getPanelData(a)
    const bPd = getPanelData(b)

    // Level 1: System display_order
    const aSysOrder = aPd?.systemOrder ?? 999
    const bSysOrder = bPd?.systemOrder ?? 999
    if (aSysOrder !== bSysOrder) return aSysOrder - bSysOrder

    // Level 2: Panel display_order
    const aPanelOrder = aPd?.panelOrder ?? 999
    const bPanelOrder = bPd?.panelOrder ?? 999
    if (aPanelOrder !== bPanelOrder) return aPanelOrder - bPanelOrder

    // Fallback to category alphabetical (for biomarkers without panel)
    if (!aPd && !bPd) {
      const catComp = a.category.localeCompare(b.category)
      if (catComp !== 0) return catComp
    }

    // Group by parent: use parent_id or own id as group key
    const aGroupKey = a.parent_id ?? a.id
    const bGroupKey = b.parent_id ?? b.id

    if (aGroupKey !== bGroupKey) {
      const aGroupName = a.parent_id
        ? (allBiomarkers?.get(a.parent_id)?.name ?? biomarkerMap.get(a.parent_id)?.name ?? a.name)
        : a.name
      const bGroupName = b.parent_id
        ? (allBiomarkers?.get(b.parent_id)?.name ?? biomarkerMap.get(b.parent_id)?.name ?? b.name)
        : b.name
      return aGroupName.localeCompare(bGroupName)
    }

    // Within same group: parent first, then variants alphabetical
    if (a.parent_id == null && b.parent_id != null) return -1
    if (a.parent_id != null && b.parent_id == null) return 1
    return a.name.localeCompare(b.name)
  })

  // Build rows
  const rows: GridRow[] = sorted.map((biomarker) => {
    // Resolve parent name for variant group labels
    let parentName: string | undefined
    if (biomarker.parent_id) {
      parentName =
        allBiomarkers?.get(biomarker.parent_id)?.name ??
        biomarkerMap.get(biomarker.parent_id)?.name
    }

    // Resolve panel/system info
    const pd = getPanelData(biomarker)

    const row: GridRow = {
      biomarker,
      category: pd?.panelName ?? biomarker.category,
      systemName: pd?.systemName,
      systemOrder: pd?.systemOrder,
      panelOrder: pd?.panelOrder,
      values: rowData.get(biomarker.id) ?? {},
      parentName,
    }

    // Attach enrichment data if available
    if (enrichment) {
      const data = enrichment.get(biomarker.id)
      if (data) {
        row.units = data.units
        row.referenceRanges = data.ranges
      }
    }

    return row
  })

  // Mark the first/last variant in each parent group (siblings are adjacent after the sort)
  const seenParents = new Set<string>()
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const pid = row.biomarker.parent_id
    if (pid && row.parentName) {
      if (!seenParents.has(pid)) {
        seenParents.add(pid)
        row.isFirstVariant = true
      }
      const next = rows[i + 1]
      if (!next || next.biomarker.parent_id !== pid) {
        row.isLastVariant = true
      }
    }
  }

  return { rows, testDates }
}
