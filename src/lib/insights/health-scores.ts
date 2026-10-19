import type { GridRow } from '@/lib/grid/grid-types'
import { getRangeStatusFromRanges, type RangeStatus } from '@/lib/grid/reference-range'

export interface CategoryScore {
  category: string
  score: number
  markerCount: number
  normalCount: number
  borderlineCount: number
  outOfRangeCount: number
  unknownCount: number
}

export interface HealthScores {
  overall: number
  categories: CategoryScore[]
  totalMarkers: number
  totalNormal: number
  totalBorderline: number
  totalOutOfRange: number
  totalUnknown: number
  latestTestDate: string | null
  latestTestName: string | null
}

const STATUS_SCORE: Record<RangeStatus, number | null> = {
  normal: 100,
  borderline: 60,
  'out-of-range': 20,
  unknown: null, // skip
}

export function computeHealthScores(
  rows: GridRow[],
  latestTestId: string,
  sex?: 'male' | 'female' | null,
  age?: number | null,
  latestTestDate?: string | null,
  latestTestName?: string | null
): HealthScores {
  const categoryMap = new Map<string, CategoryScore>()

  for (const row of rows) {
    const cell = row.values[latestTestId]
    if (!cell) continue

    const status: RangeStatus =
      row.referenceRanges && row.referenceRanges.length > 0
        ? getRangeStatusFromRanges(
            cell.value,
            row.referenceRanges,
            cell.unit,
            sex,
            age
          )
        : 'unknown'

    const cat = row.category
    const existing = categoryMap.get(cat) ?? {
      category: cat,
      score: 0,
      markerCount: 0,
      normalCount: 0,
      borderlineCount: 0,
      outOfRangeCount: 0,
      unknownCount: 0,
    }

    existing.markerCount++
    if (status === 'normal') existing.normalCount++
    else if (status === 'borderline') existing.borderlineCount++
    else if (status === 'out-of-range') existing.outOfRangeCount++
    else existing.unknownCount++

    categoryMap.set(cat, existing)
  }

  // Compute category scores
  const categories: CategoryScore[] = []
  let totalWeightedScore = 0
  let totalScoredMarkers = 0
  let totalMarkers = 0
  let totalNormal = 0
  let totalBorderline = 0
  let totalOutOfRange = 0
  let totalUnknown = 0

  for (const cat of categoryMap.values()) {
    const scoredMarkers = cat.normalCount + cat.borderlineCount + cat.outOfRangeCount
    if (scoredMarkers > 0) {
      const sum =
        cat.normalCount * STATUS_SCORE.normal! +
        cat.borderlineCount * STATUS_SCORE.borderline! +
        cat.outOfRangeCount * STATUS_SCORE['out-of-range']!
      cat.score = Math.round(sum / scoredMarkers)
      totalWeightedScore += sum
      totalScoredMarkers += scoredMarkers
    } else {
      cat.score = 0
    }

    totalMarkers += cat.markerCount
    totalNormal += cat.normalCount
    totalBorderline += cat.borderlineCount
    totalOutOfRange += cat.outOfRangeCount
    totalUnknown += cat.unknownCount

    categories.push(cat)
  }

  categories.sort((a, b) => a.category.localeCompare(b.category))

  const overall = totalScoredMarkers > 0
    ? Math.round(totalWeightedScore / totalScoredMarkers)
    : 0

  return {
    overall,
    categories,
    totalMarkers,
    totalNormal,
    totalBorderline,
    totalOutOfRange,
    totalUnknown,
    latestTestDate: latestTestDate ?? null,
    latestTestName: latestTestName ?? null,
  }
}
