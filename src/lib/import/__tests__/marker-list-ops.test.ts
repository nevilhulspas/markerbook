import { describe, it, expect } from 'vitest'
import type { Biomarker } from '@/lib/database.types'
import type { MatchedMarker } from '@/lib/extraction/types'
import {
  applyCreatedBiomarkers,
  biomarkerMappingUpdates,
  buildUnitOptions,
  createEmptyMarker,
  getMarkerResolution,
  hasDuplicateSelection,
  insertEmptyMarker,
  mergeLocalBiomarkers,
  moveMarkerAt,
  removeMarkerAt,
  removeMarkersAt,
  rowKeyOf,
  unitFilter,
  updateMarkerAt,
  withRowIds,
} from '../marker-list-ops'

function marker(over: Partial<MatchedMarker> = {}): MatchedMarker {
  return {
    name: 'Ferritin',
    value: 120,
    unit: 'ng/mL',
    confidence: 'high',
    catalog_match: 'Ferritin',
    biomarker_id: 'bm-ferritin',
    capture_loinc_code: null,
    catalog_name: 'Ferritin',
    catalog_unit: 'ng/mL',
    matched: true,
    selected: true,
    ...over,
  }
}

function biomarker(over: Partial<Biomarker> = {}): Biomarker {
  return {
    id: 'bm-1',
    name: 'Ferritin',
    short_name: null,
    category: 'Iron',
    unit: 'ng/mL',
    is_custom: false,
    description: null,
    ref_range_low: null,
    ref_range_high: null,
    ref_range_low_male: null,
    ref_range_high_male: null,
    ref_range_low_female: null,
    ref_range_high_female: null,
    range_source: null,
    aliases: [],
    parent_id: null,
    variant_name: null,
    panel_id: null,
    archived_at: null,
    loinc_code: null,
    method: null,
    created_at: '',
    ...over,
  }
}

const names = (ms: MatchedMarker[]) => ms.map((m) => m.name)

describe('getMarkerResolution', () => {
  it('is matched when the marker is matched, whatever the capture fields say', () => {
    expect(getMarkerResolution(marker({ capture_loinc_code: '1-1', capture_custom: true }))).toBe('matched')
  })

  it('is capturable when unmatched with a LOINC code (even if also custom)', () => {
    expect(getMarkerResolution(marker({ matched: false, capture_loinc_code: '1-1' }))).toBe('capturable')
    expect(getMarkerResolution(marker({ matched: false, capture_loinc_code: '1-1', capture_custom: true }))).toBe('capturable')
  })

  it('is custom when unmatched, no LOINC code, and capture_custom', () => {
    expect(getMarkerResolution(marker({ matched: false, capture_custom: true }))).toBe('custom')
  })

  it('is unresolved otherwise (empty LOINC code counts as none)', () => {
    expect(getMarkerResolution(marker({ matched: false }))).toBe('unresolved')
    expect(getMarkerResolution(marker({ matched: false, capture_loinc_code: '', capture_custom: false }))).toBe('unresolved')
    expect(getMarkerResolution(marker({ matched: false, capture_loinc_code: undefined }))).toBe('unresolved')
  })
})

describe('hasDuplicateSelection', () => {
  const dupes = new Set(['bm-ferritin'])

  it('is true for a selected marker whose biomarker id is a duplicate', () => {
    expect(hasDuplicateSelection(marker(), dupes)).toBe(true)
  })

  it('is false when unselected, unmapped, or not a duplicate', () => {
    expect(hasDuplicateSelection(marker({ selected: false }), dupes)).toBe(false)
    expect(hasDuplicateSelection(marker({ biomarker_id: null }), dupes)).toBe(false)
    expect(hasDuplicateSelection(marker({ biomarker_id: 'bm-other' }), dupes)).toBe(false)
  })
})

describe('createEmptyMarker', () => {
  it('returns a blank, unmatched, selected low-confidence row', () => {
    expect(createEmptyMarker()).toEqual({
      name: '',
      value: 0,
      unit: '',
      confidence: 'low',
      catalog_match: null,
      biomarker_id: null,
      catalog_name: null,
      catalog_unit: null,
      matched: false,
      selected: true,
      row_id: expect.any(String),
    })
  })

  it('returns a fresh object with its own row id each call', () => {
    const a = createEmptyMarker()
    const b = createEmptyMarker()
    expect(a).not.toBe(b)
    expect(a.row_id).not.toBe(b.row_id)
  })
})

describe('withRowIds', () => {
  it('gives every row without an id a unique one and keeps existing ids', () => {
    const kept = marker({ name: 'A', row_id: 'keep-me' })
    const out = withRowIds([kept, marker({ name: 'B' }), marker({ name: 'C' })])
    expect(out[0]).toBe(kept)
    expect(out[1].row_id).toEqual(expect.any(String))
    expect(new Set(out.map((m) => m.row_id)).size).toBe(3)
  })

  it('returns the same array when every row already has an id', () => {
    const input = [marker({ row_id: 'a' }), marker({ row_id: 'b' })]
    expect(withRowIds(input)).toBe(input)
  })
})

describe('rowKeyOf', () => {
  it('follows the row through a move, unlike its index', () => {
    const rows = withRowIds([marker({ name: 'A' }), marker({ name: 'B' })])
    const keyOfB = rowKeyOf(rows[1], 1)
    const moved = moveMarkerAt(rows, 1, 'up')!
    expect(moved[0].name).toBe('B')
    expect(rowKeyOf(moved[0], 0)).toBe(keyOfB)
  })

  it('falls back to the index for a row without an id', () => {
    expect(rowKeyOf(marker(), 3)).toBe('index-3')
  })
})

describe('updateMarkerAt', () => {
  it('merges updates into the row at the index only, without mutating', () => {
    const input = [marker({ name: 'A' }), marker({ name: 'B' })]
    const out = updateMarkerAt(input, 1, { value: 5 })
    expect(out[0]).toBe(input[0])
    expect(out[1]).toEqual({ ...input[1], value: 5 })
    expect(input[1].value).toBe(120)
  })

  it('returns an unchanged copy for an out-of-range index', () => {
    const input = [marker()]
    const out = updateMarkerAt(input, 3, { value: 5 })
    expect(out).not.toBe(input)
    expect(out).toEqual(input)
  })
})

describe('removeMarkerAt / removeMarkersAt', () => {
  const input = [marker({ name: 'A' }), marker({ name: 'B' }), marker({ name: 'C' })]

  it('removes a single row by index', () => {
    expect(names(removeMarkerAt(input, 1))).toEqual(['A', 'C'])
    expect(names(input)).toEqual(['A', 'B', 'C'])
  })

  it('removes every row whose index is in the set', () => {
    expect(names(removeMarkersAt(input, new Set([0, 2])))).toEqual(['B'])
    expect(names(removeMarkersAt(input, new Set()))).toEqual(['A', 'B', 'C'])
  })
})

describe('insertEmptyMarker', () => {
  const input = [marker({ name: 'A' }), marker({ name: 'B' })]

  it('inserts above (at) the index', () => {
    const out = insertEmptyMarker(input, 1, 'above')
    expect(names(out)).toEqual(['A', '', 'B'])
    expect(out[1]).toEqual({ ...createEmptyMarker(), row_id: expect.any(String) })
  })

  it('inserts below (after) the index', () => {
    expect(names(insertEmptyMarker(input, 1, 'below'))).toEqual(['A', 'B', ''])
    expect(names(insertEmptyMarker(input, 0, 'below'))).toEqual(['A', '', 'B'])
  })

  it('does not mutate the input', () => {
    insertEmptyMarker(input, 0, 'above')
    expect(names(input)).toEqual(['A', 'B'])
  })
})

describe('moveMarkerAt', () => {
  const input = [marker({ name: 'A' }), marker({ name: 'B' }), marker({ name: 'C' })]

  it('moves a row up or down by one', () => {
    expect(names(moveMarkerAt(input, 1, 'up')!)).toEqual(['B', 'A', 'C'])
    expect(names(moveMarkerAt(input, 1, 'down')!)).toEqual(['A', 'C', 'B'])
    expect(names(input)).toEqual(['A', 'B', 'C'])
  })

  it('returns null when the move would leave the list', () => {
    expect(moveMarkerAt(input, 0, 'up')).toBeNull()
    expect(moveMarkerAt(input, 2, 'down')).toBeNull()
  })
})

describe('biomarkerMappingUpdates', () => {
  it('clears the mapping for null', () => {
    expect(biomarkerMappingUpdates(null)).toEqual({
      biomarker_id: null,
      catalog_name: null,
      catalog_unit: null,
      matched: false,
    })
  })

  it('maps to the biomarker id, name and unit', () => {
    expect(biomarkerMappingUpdates(biomarker({ id: 'x', name: 'Iron', unit: 'µmol/L' }))).toEqual({
      biomarker_id: 'x',
      catalog_name: 'Iron',
      catalog_unit: 'µmol/L',
      matched: true,
    })
  })
})

describe('applyCreatedBiomarkers', () => {
  const created = [
    biomarker({ id: 'new-1', name: 'Zonulin', unit: 'ng/mL' }),
    biomarker({ id: 'new-2', name: 'Omega Index', unit: '%' }),
  ]

  it('maps unresolved rows to created biomarkers by case-insensitive name', () => {
    const out = applyCreatedBiomarkers(
      [marker({ name: 'ZONULIN', matched: false, biomarker_id: null, catalog_name: null, catalog_unit: null })],
      created
    )
    expect(out[0]).toMatchObject({
      name: 'ZONULIN',
      biomarker_id: 'new-1',
      catalog_name: 'Zonulin',
      catalog_unit: 'ng/mL',
      matched: true,
    })
  })

  it('leaves matched and capturable rows untouched (same reference)', () => {
    const matched = marker({ name: 'Zonulin' })
    const capturable = marker({ name: 'Zonulin', matched: false, capture_loinc_code: '1-1' })
    const out = applyCreatedBiomarkers([matched, capturable], created)
    expect(out[0]).toBe(matched)
    expect(out[1]).toBe(capturable)
  })

  it('leaves a custom row untouched even when its name matches a created biomarker', () => {
    const custom = marker({ name: 'Omega Index', matched: false, biomarker_id: null, capture_custom: true })
    expect(applyCreatedBiomarkers([custom], created)[0]).toBe(custom)
  })

  it('leaves unresolved rows without a created match untouched', () => {
    const other = marker({ name: 'Unknown', matched: false, biomarker_id: null })
    expect(applyCreatedBiomarkers([other], created)[0]).toBe(other)
  })

  it('uses the last created biomarker when two share a lowercased name', () => {
    const out = applyCreatedBiomarkers(
      [marker({ name: 'zonulin', matched: false, biomarker_id: null })],
      [...created, biomarker({ id: 'new-3', name: 'ZONULIN' })]
    )
    expect(out[0].biomarker_id).toBe('new-3')
  })
})

describe('buildUnitOptions', () => {
  it('unions catalog, marker and local units, de-duplicated and sorted', () => {
    const out = buildUnitOptions(
      [biomarker({ unit: 'ng/mL' }), biomarker({ unit: '' }), biomarker({ unit: 'U/L' })],
      [marker({ unit: 'ng/mL' }), marker({ unit: 'mmol/L' }), marker({ unit: '' })],
      ['µg/L', 'U/L']
    )
    expect(out).toEqual([
      { value: 'U/L', label: 'U/L' },
      { value: 'mmol/L', label: 'mmol/L' },
      { value: 'ng/mL', label: 'ng/mL' },
      { value: 'µg/L', label: 'µg/L' },
    ])
  })

  it('keeps an empty local unit (only catalog and marker units skip empties)', () => {
    expect(buildUnitOptions([], [], [''])).toEqual([{ value: '', label: '' }])
  })
})

describe('unitFilter', () => {
  it('always keeps the "create new unit" option', () => {
    expect(unitFilter({ value: '__create_new_unit__', label: '+ Create new unit' }, 'zzz')).toBe(true)
  })

  it('matches value or label case-insensitively', () => {
    expect(unitFilter({ value: 'ng/mL', label: 'ng/mL' }, 'NG')).toBe(true)
    expect(unitFilter({ value: 'x', label: 'Milligram' }, 'gram')).toBe(true)
    expect(unitFilter({ value: 'ng/mL', label: 'ng/mL' }, 'mmol')).toBe(false)
  })
})

describe('mergeLocalBiomarkers', () => {
  it('appends locally created biomarkers not already in the catalog', () => {
    const a = biomarker({ id: 'a' })
    const b = biomarker({ id: 'b' })
    const c = biomarker({ id: 'c' })
    const out = mergeLocalBiomarkers([a, b], [biomarker({ id: 'b', name: 'dup' }), c])
    expect(out).toEqual([a, b, c])
  })

  it('keeps duplicate local ids (only catalog ids are de-duplicated)', () => {
    const c = biomarker({ id: 'c' })
    expect(mergeLocalBiomarkers([], [c, c])).toEqual([c, c])
  })
})
