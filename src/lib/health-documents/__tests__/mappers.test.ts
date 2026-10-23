import { describe, it, expect } from 'vitest'
import { bloodExtractionToValues, dutchExtractionToValues } from '../mappers'
import type { ExtractionResult, MatchedMarker } from '@/lib/extraction/types'
import type { DutchMatchedMarker } from '@/lib/dutch/parse'

const result: ExtractionResult = {
  test_date: '2026-05-01',
  lab_name: 'Bodimed',
  sample_type: 'serum',
  markers: [],
}

function marker(over: Partial<MatchedMarker>): MatchedMarker {
  return {
    name: 'Ferritin', value: 120, unit: 'ng/mL', confidence: 'high', catalog_match: 'Ferritin',
    biomarker_id: '11111111-1111-1111-1111-111111111111', catalog_name: 'Ferritin',
    catalog_unit: 'ng/mL', matched: true, selected: true, ...over,
  }
}

describe('bloodExtractionToValues', () => {
  it('keeps only selected+matched markers with a biomarker_id', () => {
    const values = bloodExtractionToValues(
      result,
      [marker({}), marker({ selected: false }), marker({ matched: false, biomarker_id: null })],
      'u/chat/x.pdf',
      '2000-01-01'
    )
    expect(values.markers).toHaveLength(1)
    expect(values.markers[0]).toMatchObject({
      biomarker_id: '11111111-1111-1111-1111-111111111111', value: 120, unit: 'ng/mL',
    })
    expect(values.pdf_storage_path).toBe('u/chat/x.pdf')
    expect(values.sample_type).toBe('serum')
    expect(values.test_date).toBe('2026-05-01')
  })

  it('falls back to the provided date when test_date is null', () => {
    const v = bloodExtractionToValues({ ...result, test_date: null }, [marker({})], null, '2000-01-01')
    expect(v.test_date).toBe('2000-01-01')
    expect(v.pdf_storage_path).toBeUndefined()
  })
})

describe('bloodExtractionToValues — chat "log it" regressions', () => {
  it('keeps custom (non-LOINC) markers', () => {
    const v = bloodExtractionToValues(
      result,
      [marker({ name: 'AA/EPA', matched: false, biomarker_id: null, capture_custom: true, unit: 'ratio' })],
      null,
      '2000-01-01'
    )
    expect(v.markers).toEqual([expect.objectContaining({ capture_custom: true, name: 'AA/EPA' })])
  })

  it('fills a missing unit from the catalogue unit', () => {
    const v = bloodExtractionToValues(result, [marker({ unit: '' })], null, '2000-01-01')
    expect(v.markers[0]).toMatchObject({ unit: 'ng/mL' })
  })

  it('keeps one row when the report lists a marker twice', () => {
    const v = bloodExtractionToValues(result, [marker({ value: 120 }), marker({ value: 125 })], null, '2000-01-01')
    expect(v.markers).toHaveLength(1)
    expect(v.markers[0]).toMatchObject({ value: 120 })
  })
})

describe('dutchExtractionToValues', () => {
  const dm = (over: Partial<DutchMatchedMarker> = {}): DutchMatchedMarker => ({
    name: 'Cortisol', value: 10, unit: 'ng/mg', timepoint: 'morning', confidence: 'high',
    catalog_match: 'Cortisol', biomarker_id: '22222222-2222-2222-2222-222222222222',
    catalog_name: 'Cortisol', matched: true, selected: true, ...over,
  }) as DutchMatchedMarker

  it('maps selected+matched markers and keeps timepoint', () => {
    const v = dutchExtractionToValues(
      { test_date: '2026-04-02', patient_sex: 'female', markers: [] },
      [dm(), dm({ matched: false, biomarker_id: null })],
      'u/chat/d.pdf'
    )
    expect(v.markers).toHaveLength(1)
    expect(v.markers[0]).toMatchObject({ value: 10, unit: 'ng/mg', timepoint: 'morning' })
    expect(v.test_date).toBe('2026-04-02')
    expect(v.pdf_storage_path).toBe('u/chat/d.pdf')
  })
})
