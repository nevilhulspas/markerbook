'use server'

import { getSessionUser } from '@/lib/supabase/session'
import {
  buildInsightsChatSystemPrompt,
  type DutchContext,
  type MicrobiomeTestContext,
  type OtherTestContext,
  type RmrContext,
} from '@/lib/insights/insights-chat-prompt'
import { loadMemoryForPrompt } from '@/lib/insights/memory-tool'
import type { SnpVariant } from '@/lib/database.types'
import type {
  MarkerHistoryEntry,
  ProfileContext,
  SupplementContext,
} from '@/lib/interpretation/types'

interface ContextInput {
  markerHistory: MarkerHistoryEntry[]
  profile: ProfileContext
  supplements: SupplementContext[]
  geneticSnps: SnpVariant[]
  dutchContext: DutchContext | null
  microbiomeTests: MicrobiomeTestContext[]
  otherTests: OtherTestContext[]
  rmrContext: RmrContext | null
}

/**
 * Rebuild the exact system prompt the Health AI chat sends to the model, so the
 * UI can show the user their full context window. Mirrors /api/insights-chat:
 * builds the prompt from the same data and appends memory when the flag is on.
 */
export async function getInsightsContextPreview(
  input: ContextInput
): Promise<{ data: string | null; error: string | null }> {
  const { user, authError } = await getSessionUser()

  if (!user) return { data: null, error: authError ?? 'Not authenticated' }
  if (user.app_metadata?.role !== 'admin') {
    return { data: null, error: 'Admin access required.' }
  }

  let systemPrompt = buildInsightsChatSystemPrompt({
    markerHistory: input.markerHistory ?? [],
    profile: input.profile ?? {},
    supplements: input.supplements ?? [],
    geneticSnps: input.geneticSnps ?? [],
    dutchContext: input.dutchContext ?? undefined,
    microbiomeTests: input.microbiomeTests ?? [],
    otherTests: input.otherTests ?? [],
    rmr: input.rmrContext ?? null,
  })

  if (process.env.INSIGHTS_MEMORY_ENABLED === 'true') {
    systemPrompt += '\n\n' + (await loadMemoryForPrompt(user.id))
  }

  return { data: systemPrompt, error: null }
}
