export const CSV_RANGE_HEADERS = [
  'biomarker_name',
  'unit',
  'sex',
  'age_min',
  'age_max',
  'range_low',
  'range_high',
  'source',
  'range_type',
] as const

export interface ParsedRange {
  biomarker_name: string
  unit: string
  sex: string
  age_min: string
  age_max: string
  range_low: string
  range_high: string
  source: string
  range_type: string
}

export interface CsvParseResult {
  rows: ParsedRange[]
  errors: { line: number; message: string }[]
}

const VALID_SEX_VALUES = new Set(['male', 'female', 'general'])

function isNumericOrEmpty(value: string): boolean {
  if (value.trim() === '') return true
  return !isNaN(Number(value))
}

export function parseCsvRanges(csvText: string): CsvParseResult {
  const lines = csvText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return { rows: [], errors: [] }
  }

  // Parse header row (case-insensitive)
  const headerLine = lines[0]
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase())

  // Validate all required headers are present
  const missingHeaders = CSV_RANGE_HEADERS.filter(
    (required) => !headers.includes(required)
  )

  if (missingHeaders.length > 0) {
    throw new Error(
      `Missing required headers: ${missingHeaders.join(', ')}`
    )
  }

  // Build header index lookup
  const headerIndex = new Map<string, number>()
  for (const required of CSV_RANGE_HEADERS) {
    headerIndex.set(required, headers.indexOf(required))
  }

  const rows: ParsedRange[] = []
  const errors: { line: number; message: string }[] = []

  // Process data lines (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const values = line.split(',').map((v) => v.trim())

    const getValue = (header: string): string => {
      const idx = headerIndex.get(header)
      if (idx === undefined || idx >= values.length) return ''
      return values[idx]
    }

    const parsed: ParsedRange = {
      biomarker_name: getValue('biomarker_name'),
      unit: getValue('unit'),
      sex: getValue('sex'),
      age_min: getValue('age_min'),
      age_max: getValue('age_max'),
      range_low: getValue('range_low'),
      range_high: getValue('range_high'),
      source: getValue('source'),
      range_type: getValue('range_type'),
    }

    // Validate row
    const lineNumber = i // 1-indexed from data start
    const lineErrors: string[] = []

    if (!VALID_SEX_VALUES.has(parsed.sex.toLowerCase())) {
      lineErrors.push(`Invalid sex value: "${parsed.sex}" (must be male, female, or general)`)
    }

    if (!isNumericOrEmpty(parsed.range_low)) {
      lineErrors.push(`Invalid range_low value: "${parsed.range_low}" (must be numeric or empty)`)
    }

    if (!isNumericOrEmpty(parsed.range_high)) {
      lineErrors.push(`Invalid range_high value: "${parsed.range_high}" (must be numeric or empty)`)
    }

    if (parsed.source.trim() === '') {
      lineErrors.push('Missing required field: source')
    }

    if (lineErrors.length > 0) {
      for (const msg of lineErrors) {
        errors.push({ line: lineNumber, message: msg })
      }
    } else {
      rows.push(parsed)
    }
  }

  return { rows, errors }
}
