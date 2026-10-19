export interface NevoSeedRow {
  nevo_code: string
  name_nl: string
  name_en: string | null
  synonyms: string | null
  food_group_nl: string | null
  food_group_en: string | null
  kcal_per_100g: number | null
  protein_per_100g: number | null
  carbs_per_100g: number | null
  fat_per_100g: number | null
  fiber_per_100g: number | null
  sugar_per_100g: number | null
  sodium_mg_per_100g: number | null
  sat_fat_per_100g: number | null
}

/** Strip surrounding double-quotes and trim whitespace from a single CSV cell. */
function stripCell(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

/** Parse a NEVO CSV numeric value: decimal-comma → decimal-point, empty → null. */
function parseNum(raw: string): number | null {
  const s = stripCell(raw)
  if (s === '') return null
  const n = Number(s.replace(',', '.'))
  return Number.isNaN(n) ? null : n
}

/** Parse a NEVO CSV string value: empty after stripping → null. */
function parseStr(raw: string): string | null {
  const s = stripCell(raw)
  return s === '' ? null : s
}

// Column header → NevoSeedRow field mapping
const COLUMN_MAP: Readonly<Record<string, keyof NevoSeedRow>> = {
  'NEVO-code': 'nevo_code',
  'Voedingsmiddelnaam/Dutch food name': 'name_nl',
  'Engelse naam/Food name': 'name_en',
  Synoniem: 'synonyms',
  Voedingsmiddelgroep: 'food_group_nl',
  'Food group': 'food_group_en',
  'ENERCC (kcal)': 'kcal_per_100g',
  'PROT (g)': 'protein_per_100g',
  'CHO (g)': 'carbs_per_100g',
  'FAT (g)': 'fat_per_100g',
  'FIBT (g)': 'fiber_per_100g',
  'SUGAR (g)': 'sugar_per_100g',
  'NA (mg)': 'sodium_mg_per_100g',
  'FASAT (g)': 'sat_fat_per_100g',
}

const NUMERIC_FIELDS = new Set<keyof NevoSeedRow>([
  'kcal_per_100g',
  'protein_per_100g',
  'carbs_per_100g',
  'fat_per_100g',
  'fiber_per_100g',
  'sugar_per_100g',
  'sodium_mg_per_100g',
  'sat_fat_per_100g',
])

export function parseNevoCsv(text: string): NevoSeedRow[] {
  const lines = text.split('\n')
  if (lines.length < 2) return []

  // Build header-name → column-index map
  const headerLine = lines[0]!
  const headers = headerLine.split('|').map(stripCell)
  const indexByHeader: Map<string, number> = new Map()
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]
    if (h !== undefined) indexByHeader.set(h, i)
  }

  // Build field → column-index map
  const fieldIndex: Partial<Record<keyof NevoSeedRow, number>> = {}
  for (const [headerName, fieldName] of Object.entries(COLUMN_MAP)) {
    const idx = indexByHeader.get(headerName)
    if (idx !== undefined) {
      fieldIndex[fieldName] = idx
    }
  }

  const results: NevoSeedRow[] = []

  for (let lineNum = 1; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum]
    if (!line || line.trim() === '') continue

    const cells = line.split('|')

    function cell(field: keyof NevoSeedRow): string {
      const idx = fieldIndex[field]
      return idx !== undefined ? (cells[idx] ?? '') : ''
    }

    // Required fields
    const nevo_code = stripCell(cell('nevo_code'))
    const name_nl = stripCell(cell('name_nl'))

    if (!nevo_code || !name_nl) continue

    const row: NevoSeedRow = {
      nevo_code,
      name_nl,
      name_en: parseStr(cell('name_en')),
      synonyms: parseStr(cell('synonyms')),
      food_group_nl: parseStr(cell('food_group_nl')),
      food_group_en: parseStr(cell('food_group_en')),
      kcal_per_100g: parseNum(cell('kcal_per_100g')),
      protein_per_100g: parseNum(cell('protein_per_100g')),
      carbs_per_100g: parseNum(cell('carbs_per_100g')),
      fat_per_100g: parseNum(cell('fat_per_100g')),
      fiber_per_100g: parseNum(cell('fiber_per_100g')),
      sugar_per_100g: parseNum(cell('sugar_per_100g')),
      sodium_mg_per_100g: parseNum(cell('sodium_mg_per_100g')),
      sat_fat_per_100g: parseNum(cell('sat_fat_per_100g')),
    }

    // Satisfy exhaustive check — NUMERIC_FIELDS is used only for type safety guard
    void NUMERIC_FIELDS

    results.push(row)
  }

  return results
}
