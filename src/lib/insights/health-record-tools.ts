import type { TypedSupabaseClient } from '@/lib/supabase/database'
import type { ChatAttachment } from '@/lib/database.types'

import { createBloodTestTools } from './health-records/blood-test-tools'
import { createHealthTestTools } from './health-records/health-test-tools'
import { createBodyFoodTools } from './health-records/body-food-tools'

export {
  resolveMarkerInputs,
  resolveMarkerInputsViaLoinc,
  type MarkerInput,
  type ResolvedMarker,
} from './health-records/marker-inputs'
export { NUMERIC_FIELD_WHITELIST } from './health-records/health-test-tools'

/**
 * Insights-chat tools to CRUD the user's health records: blood tests (incl.
 * per-marker results), DEXA / microbiome / DUTCH / RMR tests, food logs,
 * nutrition targets and the weight/body log.
 * `supabase` is a service-role client; every query filters by `userId`.
 * WRITE only on explicit user intent; never delete without confirmation.
 *
 * The per-domain sets live in `./health-records/`. Spread order is the tool
 * order the model sees (and prompt caching keys on) — keep it stable.
 */
export function createHealthRecordTools(
  supabase: TypedSupabaseClient,
  userId: string,
  attachments: ChatAttachment[] = []
) {
  return {
    ...createBloodTestTools(supabase, userId, attachments),
    ...createHealthTestTools(supabase, userId),
    ...createBodyFoodTools(supabase, userId),
  }
}
