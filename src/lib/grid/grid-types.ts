import type {
  Biomarker,
  BiomarkerUnit,
  Panel,
  ReferenceRange,
  System,
} from '@/lib/database.types'

export interface GridCellData {
  value: number
  unit: string
  resultId: string
  /** '<' / '>' etc. for a result such as "<0.5"; absent for a plain value. */
  qualifier?: string | null
}

export interface GridRow {
  biomarker: Biomarker
  category: string // panel name (or legacy category as fallback)
  systemName?: string // system name for Level 1 grouping
  systemOrder?: number // system display_order for sorting
  panelOrder?: number // panel display_order for sorting
  values: Record<string, GridCellData | null> // keyed by blood_test id
  units?: BiomarkerUnit[] // available units for this biomarker
  referenceRanges?: ReferenceRange[] // reference ranges for this biomarker
  /** The catalogue unit when `biomarker.unit` was switched to a display unit. */
  catalogueUnit?: string
  parentName?: string // resolved parent biomarker name for variant group labels
  isFirstVariant?: boolean // true for the first child in a parent group
  isLastVariant?: boolean // true for the last child in a parent group
}

export interface GridData {
  rows: GridRow[]
  testDates: { id: string; date: string; name: string }[]
}

/** Lookup maps for panel/system metadata */
export interface PanelSystemLookup {
  panels: Map<string, Panel & { system: System }>
}
