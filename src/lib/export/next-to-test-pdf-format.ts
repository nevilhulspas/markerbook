// Column options and row shapes for the next-to-test PDF. Kept apart from
// export-next-to-test.ts so the UI can show the options without loading jsPDF.

export type NextToTestPdfColumn = 'source' | 'note' | 'due' | 'status'

export interface NextToTestPdfFormat {
  /** Optional columns to include. `#` and `Name` are always shown. */
  columns: NextToTestPdfColumn[]
}

/** Canonical column order (input order is ignored so the PDF is stable). */
export const NTT_PDF_COLUMNS: NextToTestPdfColumn[] = ['source', 'note', 'due', 'status']

export const NTT_PDF_COLUMN_LABELS: Record<NextToTestPdfColumn, string> = {
  source: 'Source',
  note: 'Note',
  due: 'Due',
  status: 'Status',
}

export const DEFAULT_NTT_PDF_FORMAT: NextToTestPdfFormat = {
  columns: [...NTT_PDF_COLUMNS],
}

/** Slim, serialisable row (subset of the page's resolved entry). */
export interface NttPdfRow {
  name: string
  source_label: string // 'Any lab' | lab name | '—'
  note: string | null
  due_date: string | null
  status: 'pending' | 'done'
}

export interface NttPdfGroup {
  /** Category-group header, e.g. "Blood markers", "Microbiome". */
  label: string
  rows: NttPdfRow[]
}
