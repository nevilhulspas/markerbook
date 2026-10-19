import type { CSSProperties } from 'react'
import type { Column } from '@tanstack/react-table'

import type { GridRow } from '@/lib/grid/grid-types'

/** Test date column IDs that are NOT pinned static columns */
export const STATIC_COLUMN_IDS = new Set(['marker_name', 'marker_fullname', 'marker_unit', 'ref_normal', 'ref_optimal'])

export function getColumnPinningStyles(column: Column<GridRow>, bgOverride?: string): CSSProperties {
  const isPinned = column.getIsPinned()
  const isLastLeftPinned =
    isPinned === 'left' && column.getIsLastColumn('left')

  return {
    boxShadow: isLastLeftPinned
      ? '-4px 0 4px -4px gray inset'
      : undefined,
    left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
    position: isPinned ? 'sticky' : 'relative',
    width: column.getSize(),
    zIndex: isPinned ? 1 : 0,
    backgroundColor: isPinned ? (bgOverride ?? 'var(--background)') : bgOverride,
  }
}
