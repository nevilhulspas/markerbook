'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { labTestSuggestionSchema } from '@/lib/validations/lab-test-suggestion'
import { suggestLabTestFromUrl, SuggestTestError } from '@/lib/labs/suggest-test'

// Per-user guardrail: tests auto-publish, so cap how many a user can add per hour.
const MAX_SUGGESTIONS_PER_HOUR = 20

export interface SuggestLabTestActionResult {
  data: { added: string[]; duplicates: string[] } | null
  error: string | null
}

/**
 * User-facing action behind the "Suggest a missing test" dialog. Validates the
 * input, requires sign-in, rate-limits per user, then delegates to
 * {@link suggestLabTestFromUrl}. On success revalidates the lab page so the new
 * test appears. Never throws — every failure is returned as `error`.
 */
export async function suggestLabTest(
  values: unknown
): Promise<SuggestLabTestActionResult> {
  const parsed = labTestSuggestionSchema.safeParse(values)
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? 'Invalid submission.' }
  }

  const { user, authError } = await getSessionUser()
  if (!user) {
    return { data: null, error: authError ?? 'You must be signed in to suggest a test.' }
  }

  // Rate limit: count this user's suggested tests in the last hour.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error: countError } = await supabaseAdmin
    .from('lab_tests')
    .select('id', { count: 'exact', head: true })
    .eq('submitted_by', user.id)
    .gt('created_at', since)
  if (countError) {
    console.error('suggestLabTest: rate-limit count failed', countError)
    return { data: null, error: 'Could not verify your recent activity. Please try again.' }
  }
  if ((count ?? 0) >= MAX_SUGGESTIONS_PER_HOUR) {
    return {
      data: null,
      error: "You've suggested a lot of tests recently. Please try again later.",
    }
  }

  const { labId, url } = parsed.data
  try {
    const result = await suggestLabTestFromUrl({ labId, url, userId: user.id })
    revalidatePath(`/labs/${labId}`)
    return { data: result, error: null }
  } catch (err) {
    if (err instanceof SuggestTestError) {
      return { data: null, error: err.message }
    }
    console.error('suggestLabTest: unexpected error', err)
    return { data: null, error: 'Something went wrong. Please try again.' }
  }
}
