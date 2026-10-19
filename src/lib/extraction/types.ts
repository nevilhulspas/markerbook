export interface ExtractedMarker {
  name: string // Biomarker name as shown on report
  value: number // Numeric value
  unit: string // Unit of measurement
  confidence: 'high' | 'medium' | 'low'
  catalog_match: string | null // Exact catalog biomarker name matched by AI
  loinc_code?: string | null   // AI's best LOINC code for this marker, validated downstream
  ref_range_low?: number | null  // reference range printed on the report, if any
  ref_range_high?: number | null
}

export interface ExtractionResult {
  test_date: string | null // YYYY-MM-DD or null
  lab_name: string | null
  sample_type: 'serum' | 'plasma' | 'unknown'
  markers: ExtractedMarker[]
}

export interface MatchedMarker extends ExtractedMarker {
  biomarker_id: string | null // Matched catalog biomarker ID
  capture_loinc_code?: string | null // LOINC code to capture at save time (no biomarker yet)
  capture_custom?: boolean // No catalog/LOINC match — create a custom biomarker at save time
  catalog_name: string | null // Canonical name from catalog
  catalog_unit: string | null // Standard unit from catalog
  matched: boolean // Whether a catalog match was found
  selected: boolean // Whether user has selected this for import (default: true)
  row_id?: string // Client-only stable key for the review table; never saved
}

export type ExtractionResponse =
  | {
      success: true
      data: ExtractionResult
      matched_markers: MatchedMarker[]
      storage_path: string
    }
  | {
      success: false
      error: string
      partial_data?: ExtractionResult
      matched_markers?: MatchedMarker[]
      storage_path?: string
    }
