import type { ExportListItem } from '@/lib/labs/lab-test-tools'

// Client-safe (no jsPDF / no 'ai' imports) so both the export util and the chat
// card can use it, and the server tool can import the types. ExportListItem is a
// type-only import (erased), so this does not bundle the AI tool.

export type ListColumn = 'method' | 'cost' | 'sample' | 'turnaround' | 'reason'
export type ListSort = 'default' | 'name' | 'cost_asc' | 'cost_desc'

export interface ListFormat {
  /** Optional columns to include (Test name + # are always shown). */
  columns: ListColumn[]
  sort: ListSort
  /** Drop tests the lab doesn't offer (and their "(not available)" text). */
  hideUnavailable: boolean
}

export const ALL_COLUMNS: ListColumn[] = ['method', 'cost', 'sample', 'turnaround', 'reason']

export const COLUMN_LABELS: Record<ListColumn, string> = {
  method: 'Method',
  cost: 'Cost',
  sample: 'Sample',
  turnaround: 'Turnaround',
  reason: 'Why',
}

export const DEFAULT_FORMAT: ListFormat = {
  columns: ['method', 'cost', 'sample', 'turnaround', 'reason'],
  sort: 'default',
  hideUnavailable: false,
}

/** Coerce loose/partial input (e.g. from the AI tool) into a valid ListFormat. */
export function normalizeFormat(raw: Partial<ListFormat> | null | undefined): ListFormat {
  if (!raw) return { ...DEFAULT_FORMAT }
  const columns = Array.isArray(raw.columns)
    ? ALL_COLUMNS.filter((c) => raw.columns!.includes(c))
    : DEFAULT_FORMAT.columns
  const sort: ListSort =
    raw.sort === 'name' || raw.sort === 'cost_asc' || raw.sort === 'cost_desc'
      ? raw.sort
      : 'default'
  return { columns, sort, hideUnavailable: Boolean(raw.hideUnavailable) }
}

function cmpCost(a: ExportListItem, b: ExportListItem, dir: 1 | -1): number {
  const an = a.cost == null
  const bn = b.cost == null
  if (an && bn) return 0
  if (an) return 1 // unpriced always last
  if (bn) return -1
  return ((a.cost as number) - (b.cost as number)) * dir
}

/** PURE: filter (hide unavailable) + sort items per the format. */
export function formatListItems(items: ExportListItem[], format: ListFormat): ExportListItem[] {
  const out = format.hideUnavailable ? items.filter((i) => i.found) : items.slice()
  switch (format.sort) {
    case 'name':
      out.sort((a, b) => a.testName.localeCompare(b.testName))
      break
    case 'cost_asc':
      out.sort((a, b) => cmpCost(a, b, 1))
      break
    case 'cost_desc':
      out.sort((a, b) => cmpCost(a, b, -1))
      break
    default:
      break // keep the order the AI built
  }
  return out
}
