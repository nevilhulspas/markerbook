import type { TypedSupabaseClient } from '@/lib/supabase/database'

import { createAskUserTool } from './ask-user'
import { createCatalogueTools } from './catalogue-tools'
import { createNextToTestTools } from './next-to-test-tools'

export type {
  BuildListsResult,
  ExportList,
  ExportListItem,
  FinderBiomarker,
  FinderTest,
  LabTestMeta,
} from './types'
export { enrichListItems, mapCatalogueRows, matchOneLab, resolveLabsByName } from './catalogue'

/**
 * Build the lab-test tools for the insights chat.
 *
 * - `list_lab_tests` (server execute): the FULL catalogue for one or more labs in
 *   a single call — for broad/comprehensive requests, so the model sees
 *   everything at once instead of fanning out into many narrow finder calls.
 * - `lab_test_finder` (server execute): targeted lookup — which approved labs
 *   offer which tests, filtered by name query and/or catalogue biomarker names.
 * - `build_lab_test_lists` (server execute): finalize per-lab lists; each item is
 *   re-validated against the lab and enriched with metadata. The chat renders the
 *   result as downloadable per-lab cards.
 * - `ask_user` (NO execute → client-resolved): ask the user a multiple-choice
 *   question; the chat renders it and returns the answer.
 *
 * `supabase` should be a service-role client; every query filters status =
 * 'approved' explicitly so only public data is exposed.
 *
 * `userId` is the authenticated user whose next-to-test lists the
 * next-to-test tools read and write.
 */
export function createLabTestTools(supabase: TypedSupabaseClient, userId: string) {
  // Spread order is the tool order the model sees — keep it stable (the
  // prompt cache keys on the tool definitions).
  return {
    ...createCatalogueTools(supabase),
    ask_user: createAskUserTool(),

    // ----- next-to-test tools (AUT-848) -----
    ...createNextToTestTools(supabase, userId),
  }
}
