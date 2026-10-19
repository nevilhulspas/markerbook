import { describe, it, expect } from 'vitest'
import type { MatchedMarker } from '@/lib/extraction/types'
import { prepareMarkersForSave } from '../prepare-markers-for-save'

function marker(over: Partial<MatchedMarker>): MatchedMarker {
  return {
    name: 'Ferritin',
    value: 120,
    unit: 'ng/mL',
    confidence: 'high',
    catalog_match: 'Ferritin',
    biomarker_id: '11111111-1111-4111-8111-111111111111',
    capture_loinc_code: null,
    catalog_name: 'Ferritin',
    catalog_unit: 'ng/mL',
    matched: true,
    selected: true,
    ...over,
  }
}

describe('prepareMarkersForSave', () => {
  it('keeps only selected markers that have a biomarker_id or a capture_loinc_code', () => {
    const { markers } = prepareMarkersForSave([
      marker({}),
      marker({ selected: false }),
      marker({ matched: false, biomarker_id: null, capture_loinc_code: null }),
    ])
    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({
      biomarker_id: '11111111-1111-4111-8111-111111111111',
      value: 120,
      unit: 'ng/mL',
    })
  })

  it('emits a capturable entry carrying the raw lab name for aliasing', () => {
    const { markers } = prepareMarkersForSave([
      marker({
        name: 'S-Transferrine receptor',
        biomarker_id: null,
        matched: false,
        capture_loinc_code: '30248-9',
        catalog_name: 'Soluble Transferrin Receptor',
        unit: 'mg/L',
        value: 1.5,
      }),
    ])
    expect(markers).toEqual([
      {
        capture_loinc_code: '30248-9',
        name: 'S-Transferrine receptor',
        value: 1.5,
        unit: 'mg/L',
        ref_range_low: null,
        ref_range_high: null,
      },
    ])
  })

  it('emits a capture_custom entry carrying the marker name', () => {
    const { markers } = prepareMarkersForSave([
      marker({
        name: 'AA/EPA',
        biomarker_id: null,
        matched: false,
        capture_loinc_code: null,
        capture_custom: true,
        catalog_name: null,
        unit: 'ratio',
        value: 16.38,
      }),
    ])
    expect(markers).toEqual([
      {
        capture_custom: true,
        name: 'AA/EPA',
        value: 16.38,
        unit: 'ratio',
        ref_range_low: null,
        ref_range_high: null,
      },
    ])
  })

  it('flags two capture_custom markers with the same name (case-insensitive) as duplicates', () => {
    const { markers, duplicateBiomarkerIds, duplicateNames } = prepareMarkersForSave([
      marker({ name: 'AA/EPA', biomarker_id: null, matched: false, capture_loinc_code: null, capture_custom: true, unit: 'ratio', value: 16 }),
      marker({ name: 'aa/epa', biomarker_id: null, matched: false, capture_loinc_code: null, capture_custom: true, unit: 'ratio', value: 17 }),
    ])
    // Both rows still flow through (the UI shows them); the second is flagged so
    // the server-side per-test uniqueness check can surface it before a write.
    expect(markers).toHaveLength(2)
    expect(duplicateBiomarkerIds).toEqual([])
    expect(duplicateNames).toEqual(['aa/epa'])
  })

  it('flags a custom row whose name matches a mapped row\'s biomarker, in either order', () => {
    // e.g. after "Create all missing" mapped an unmatched "Zonulin" row while a
    // custom "zonulin" row stays custom: the server would resolve both to one
    // biomarker (or create a case-variant twin).
    const mapped = marker({ name: 'Zonulin', catalog_name: 'Zonulin', biomarker_id: 'bm-new' })
    const custom = marker({ name: ' zonulin ', biomarker_id: null, matched: false, capture_custom: true })

    expect(prepareMarkersForSave([mapped, custom]).duplicateNames).toEqual([' zonulin '])
    expect(prepareMarkersForSave([custom, mapped]).duplicateNames).toEqual([' zonulin '])
    // The custom row stays custom in the payload.
    expect(prepareMarkersForSave([mapped, custom]).markers[1]).toMatchObject({ capture_custom: true })
  })

  it('does not flag a custom row whose name matches no mapped biomarker', () => {
    const mapped = marker({ name: 'Ferritin' })
    const custom = marker({ name: 'Zonulin', biomarker_id: null, matched: false, capture_custom: true })
    expect(prepareMarkersForSave([mapped, custom]).duplicateNames).toEqual([])
  })

  it('flags two markers with the SAME capture_loinc_code as duplicates', () => {
    const { markers, duplicateBiomarkerIds, duplicateNames } = prepareMarkersForSave([
      marker({
        name: 'sTfR (assay A)',
        biomarker_id: null,
        matched: false,
        capture_loinc_code: '30248-9',
        catalog_name: 'Soluble Transferrin Receptor',
      }),
      marker({
        name: 'sTfR (assay B)',
        biomarker_id: null,
        matched: false,
        capture_loinc_code: '30248-9',
        catalog_name: 'Soluble Transferrin Receptor',
      }),
    ])

    // Both rows still flow through (the UI shows them), but the second is flagged.
    expect(markers).toHaveLength(2)
    expect(duplicateBiomarkerIds).toEqual([])
    expect(duplicateNames).toEqual(['Soluble Transferrin Receptor'])
  })

  it('does NOT flag distinct capture_loinc_codes as duplicates', () => {
    const { duplicateNames } = prepareMarkersForSave([
      marker({ name: 'sTfR', biomarker_id: null, matched: false, capture_loinc_code: '30248-9' }),
      marker({ name: 'Hepcidin', biomarker_id: null, matched: false, capture_loinc_code: '38445-3' }),
    ])
    expect(duplicateNames).toEqual([])
  })

  it('still flags duplicate biomarker_ids (existing behavior intact)', () => {
    const id = '22222222-2222-4222-8222-222222222222'
    const { duplicateBiomarkerIds, duplicateNames } = prepareMarkersForSave([
      marker({ biomarker_id: id, catalog_name: 'Ferritin' }),
      marker({ biomarker_id: id, catalog_name: 'Ferritin' }),
    ])
    expect(duplicateBiomarkerIds).toEqual([id])
    expect(duplicateNames).toEqual(['Ferritin'])
  })
})
