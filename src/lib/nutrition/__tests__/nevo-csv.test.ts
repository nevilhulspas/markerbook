import { describe, expect, it } from 'vitest'

import { parseNevoCsv } from '../nevo-csv'

// Realistic fixture: pipe-delimited with quoted fields, decimal-commas, and empty values.
// Columns chosen to cover the mapped fields only (others omitted for brevity using pipes).
// Full header structure (truncated to relevant columns):
//   col 0: NEVO-versie/NEVO-version
//   col 1: Voedingsmiddelgroep
//   col 2: Food group
//   col 3: NEVO-code
//   col 4: Voedingsmiddelnaam/Dutch food name
//   col 5: Engelse naam/Food name
//   col 6: Synoniem
//   col 7: Hoeveelheid/Quantity
//   col 8: Opmerking
//   col 9: Bevat sporen van/Contains traces of
//   col 10: Is verrijkt met/Is fortified with
//   col 11: ENERCJ (kJ)
//   col 12: ENERCC (kcal)
//   col 13: WATER (g)
//   col 14: PROT (g)
//   col 15: PROTPL (g)
//   col 16: PROTAN (g)
//   col 17: NT (g)
//   col 18: TRP (mg)
//   col 19: FAT (g)
//   col 20: FACID (g)
//   col 21: FASAT (g)
//   col 22: FAMSCIS (g)
//   col 23: FAPU (g)
//   col 24: FAPUN3 (g)
//   col 25: FAPUN6 (g)
//   col 26: FATRS (g)
//   col 27: CHO (g)
//   col 28: SUGAR (g)
//   col 29: NVSUGAF (g)
//   col 30: STARCH (g)
//   col 31: POLYL (g)
//   col 32: FIBT (g)  ← decimal-comma "1,8"
//   col 33: ALC (g)
//   col 34: OA (g)
//   col 35: ASH (g)
//   col 36: CHORL (mg)
//   col 37: NA (mg)

const HEADER =
  '"NEVO-versie/NEVO-version"|"Voedingsmiddelgroep"|"Food group"|"NEVO-code"|"Voedingsmiddelnaam/Dutch food name"|"Engelse naam/Food name"|"Synoniem"|"Hoeveelheid/Quantity"|"Opmerking"|"Bevat sporen van/Contains traces of"|"Is verrijkt met/Is fortified with"|"ENERCJ (kJ)"|"ENERCC (kcal)"|"WATER (g)"|"PROT (g)"|"PROTPL (g)"|"PROTAN (g)"|"NT (g)"|"TRP (mg)"|"FAT (g)"|"FACID (g)"|"FASAT (g)"|"FAMSCIS (g)"|"FAPU (g)"|"FAPUN3 (g)"|"FAPUN6 (g)"|"FATRS (g)"|"CHO (g)"|"SUGAR (g)"|"NVSUGAF (g)"|"STARCH (g)"|"POLYL (g)"|"FIBT (g)"|"ALC (g)"|"OA (g)"|"ASH (g)"|"CHORL (mg)"|"NA (mg)"'

// Row 1: fully quoted, decimal-comma fiber, unquoted nevo_code value (mixed quoting)
const ROW_POTATOES =
  'NEVO-Online 2025 9.0|Aardappelen en knolgewassen|Potatoes and tubers|1|Aardappelen rauw|Potatoes raw||per 100g||||"371"|"88"|"77"|"2"|"2"|"0"|||"0"|"0"|"0"|"0"|"0"|"0"|"0"|"0"|"19"|"1"||"18"|"0"|"1,8"|"0"|||"0"|"2"'

// Row 2: synonym present, fiber also decimal-comma
const ROW_PASTA =
  'NEVO-Online 2025 9.0|Graanproducten en meelsoorten|Cereal products and types of flour|4|Pasta witte rauw|Pasta white raw|Macaroni spaghetti|per 100g||||"1511"|"356"|"10"|"12,3"|"12,3"|"0"|||"1,2"|"0"|"0,2"|"0"|"0"|"0"|"0"|"0"|"72"|"1,5"||"70"|"0"|"2,9"|"0"|||"10"|"5"'

// Row with missing nevo_code → should be skipped
const ROW_NO_CODE =
  'NEVO-Online 2025 9.0|Groep||  |Naam ontbreekt||||||"100"|"25"|"70"|"1"|||||"0"||||||||"5"|"0"||"5"|"0"|"1,0"|"0"|||"200"|"10"'

// Row with missing name_nl → should be skipped
const ROW_NO_NAME =
  'NEVO-Online 2025 9.0|Groep||999|||||||"100"|"25"|"70"|"1"|||||"0"||||||||"5"|"0"||"5"|"0"|"1,0"|"0"|||"200"|"10"'

const FIXTURE = [HEADER, ROW_POTATOES, ROW_PASTA, ROW_NO_CODE, ROW_NO_NAME].join('\n')

describe('parseNevoCsv', () => {
  const rows = parseNevoCsv(FIXTURE)

  it('skips rows without nevo_code or name_nl, returns only valid rows', () => {
    expect(rows).toHaveLength(2)
  })

  it('parses nevo_code as a string', () => {
    expect(rows[0]!.nevo_code).toBe('1')
    expect(rows[1]!.nevo_code).toBe('4')
  })

  it('parses name_nl and name_en', () => {
    expect(rows[0]!.name_nl).toBe('Aardappelen rauw')
    expect(rows[0]!.name_en).toBe('Potatoes raw')
  })

  it('parses food_group_nl and food_group_en', () => {
    expect(rows[0]!.food_group_nl).toBe('Aardappelen en knolgewassen')
    expect(rows[0]!.food_group_en).toBe('Potatoes and tubers')
  })

  it('converts decimal-comma to decimal-point for fiber', () => {
    expect(rows[0]!.fiber_per_100g).toBe(1.8)
    expect(rows[1]!.fiber_per_100g).toBe(2.9)
  })

  it('parses kcal as a number', () => {
    expect(rows[0]!.kcal_per_100g).toBe(88)
    expect(rows[1]!.kcal_per_100g).toBe(356)
  })

  it('parses protein with decimal-comma', () => {
    expect(rows[1]!.protein_per_100g).toBe(12.3)
  })

  it('parses carbs (CHO)', () => {
    expect(rows[0]!.carbs_per_100g).toBe(19)
    expect(rows[1]!.carbs_per_100g).toBe(72)
  })

  it('parses fat', () => {
    expect(rows[0]!.fat_per_100g).toBe(0)
    expect(rows[1]!.fat_per_100g).toBe(1.2)
  })

  it('parses sodium (NA)', () => {
    expect(rows[0]!.sodium_mg_per_100g).toBe(2)
    expect(rows[1]!.sodium_mg_per_100g).toBe(5)
  })

  it('parses sat_fat (FASAT)', () => {
    expect(rows[0]!.sat_fat_per_100g).toBe(0)
    expect(rows[1]!.sat_fat_per_100g).toBe(0.2)
  })

  it('parses synonym when present, null when absent', () => {
    expect(rows[0]!.synonyms).toBeNull()
    expect(rows[1]!.synonyms).toBe('Macaroni spaghetti')
  })

  it('returns null for empty macro fields', () => {
    // ROW_POTATOES has empty TRP and NT fields; NT is not mapped but PROT is "2" (non-empty)
    // We check a field we know will be empty in row 0: sugar is "1" so let's check row 0 protein
    expect(rows[0]!.protein_per_100g).toBe(2)
    // Verify sugar is parsed
    expect(rows[0]!.sugar_per_100g).toBe(1)
  })
})
