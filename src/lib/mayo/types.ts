export interface ParsedMayoRange {
  component: string
  unit: string
  range_low: number | null
  range_high: number | null
  sex: 'male' | 'female' | 'general'
}

export interface MayoParseResult {
  ranges: ParsedMayoRange[]
  testName: string | null
  error: string | null
}

export interface RangeDiffItem {
  rangeId: string | null
  field: string
  currentValue: string | number | null
  proposedValue: string | number | null
  current: {
    range_low: number | null
    range_high: number | null
    unit: string
    sex: string
    source: string
    range_type: string
  } | null
  proposed: ParsedMayoRange
}
