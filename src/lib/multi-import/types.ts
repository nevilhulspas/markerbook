import type { ExtractionResult, MatchedMarker } from '@/lib/extraction/types'

export type ImportFileStatus =
  | 'queued'
  | 'uploading'
  | 'extracting'
  | 'complete'
  | 'error'

export interface ImportFileItem {
  id: string
  file: File
  fileName: string
  status: ImportFileStatus
  statusText: string
  extractionResult: ExtractionResult | null
  matchedMarkers: MatchedMarker[] | null
  error: string | null
  storagePath: string | null
  hasPartialData: boolean
  saved: boolean
  discarded: boolean
}

export type BatchStatus = 'idle' | 'processing' | 'complete'
