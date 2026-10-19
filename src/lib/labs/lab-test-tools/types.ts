// Shared shapes of the lab-test chat tools (also consumed by the chat UI +
// export util, via the lab-test-tools entry point).

import type { ListFormat } from '@/lib/export/list-format'

export interface FinderBiomarker {
  name: string
  short_name: string | null
}

export interface FinderTest {
  name: string
  method: string | null
  cost: number | null
  currency: string | null
  turnaround_days: number | null
  sample_type: string | null
  /**
   * Analyzing lab when this test is outsourced (e.g. "Biovis Diagnostik MVZ
   * GmbH"). Null when analyzed in-house. The model uses this to weight the
   * test's specialty value (Biovis microbiome ≠ commodity Vitamin D).
   */
  provider: string | null
  biomarkers: FinderBiomarker[]
}

export interface ExportListItem {
  testName: string
  found: boolean
  method: string | null
  cost: number | null
  currency: string | null
  turnaround_days: number | null
  sample_type: string | null
  reason: string | null
}

export interface ExportList {
  labName: string
  labFound: boolean
  items: ExportListItem[]
}

export interface BuildListsResult {
  title: string | null
  lists: ExportList[]
  /** Initial output formatting (columns / sort / hide-unavailable) the AI chose. */
  format?: ListFormat
}

export interface LabRow {
  id: string
  name: string
}

/** A lab test's exportable metadata, as selected from the DB. */
export interface LabTestMeta {
  name: string
  method: string | null
  cost: number | null
  currency: string | null
  turnaround_days: number | null
  sample_type: string | null
}
