import { supabaseAdmin } from '@/lib/supabase/admin'
import type { NevoFood } from '@/lib/database.types'
import { loadLibraryItems } from './library'
import { rerankCandidates, type LibraryItem, type MatchDeps } from './match'
import { searchOff } from './off'
import { countedAiCall } from '@/lib/ai/quota'

/** Server-side cap on uploaded photo bytes (the browser downscales, but direct/token uploads don't). */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024

/** Assembles MatchDeps for a user using the service client (token/cookie routes). */
export async function buildPhotoMatchDeps(userId: string): Promise<MatchDeps> {
  let library: LibraryItem[] = []
  try {
    library = await loadLibraryItems(supabaseAdmin, { userId, logTag: '[photo-deps]' })
  } catch (err) {
    console.error('[photo-deps] library load failed:', err)
  }

  return {
    library,
    searchNevo: async (q: string) => {
      const { data, error } = await supabaseAdmin.rpc('search_nevo', { q, max_results: 5 })
      if (error) console.error('[photo-deps] NEVO search failed:', error.message)
      return (data ?? []) as NevoFood[]
    },
    searchOff,
    // Each rerank is a model call of its own; over the limit, matching skips it.
    rerank: countedAiCall(userId, rerankCandidates, null),
  }
}
