import type { DutchTimepoint } from '@/lib/database.types'

export interface DutchExtractedMarker {
  name: string // Marker name as shown on DUTCH report
  value: number // Numeric value
  unit: string // Unit of measurement
  timepoint: DutchTimepoint | 'none' // waking|morning|afternoon|night or 'none' for non-diurnal
  confidence: 'high' | 'medium' | 'low'
  catalog_match: string // Exact catalog biomarker name matched by AI, or '' if no match
}

export interface DutchMatchedMarker extends DutchExtractedMarker {
  biomarker_id: string | null // Matched catalog biomarker ID
  catalog_name: string | null // Canonical name from catalog
  catalog_unit: string | null // Standard unit from catalog
  matched: boolean // Whether a catalog match was found
  selected: boolean // Whether user has selected this for import (default: true)
}

export interface DutchExtractionResult {
  test_date: string // YYYY-MM-DD or ''
  patient_sex: 'male' | 'female' | 'unknown'
  markers: DutchExtractedMarker[]
}

export type DutchExtractionResponse =
  | {
      success: true
      data: DutchExtractionResult
      matched_markers: DutchMatchedMarker[]
      storage_path: string
    }
  | {
      success: false
      error: string
      storage_path?: string
    }
