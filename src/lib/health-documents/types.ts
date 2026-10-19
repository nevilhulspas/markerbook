import type { TypedSupabaseClient } from '@/lib/supabase/database'
import type { MediaType } from './media-type'

export type HealthDocumentTypeId = 'blood' | 'microbiome' | 'dutch' | 'dexa' | 'rmr' | 'other'
export type AcceptedKind = 'pdf' | 'image'

/** Compact, model-agnostic summary rendered on the confirm card. */
export interface DocumentSummary {
  title: string
  dateLabel: string | null
  lines: string[]
}

export interface ParseCtx {
  userId: string
  /** Service-role client; catalog/profile reads are global or filtered by userId. */
  db: TypedSupabaseClient
}

export interface PersistResult {
  recordId: string
  href: string
}

/**
 * One indexable health-document type. parse/persist are thin adapters over the
 * existing per-type pipeline so the import page and chat share identical logic.
 */
export interface HealthDocumentType<E = unknown> {
  id: HealthDocumentTypeId
  label: string
  classifierHint: string
  accepts: AcceptedKind[]
  // `bytes` is a single file (PDF or image) OR a list of image tiles produced
  // from a long document (all sharing `mediaType`). See image-tiles.ts.
  parse(bytes: Buffer | Buffer[], mediaType: MediaType, ctx: ParseCtx): Promise<E>
  summarize(extraction: E): DocumentSummary
  persist(extraction: E, storagePath: string | null): Promise<PersistResult>
}
