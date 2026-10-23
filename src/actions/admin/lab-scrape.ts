'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isAiConfigured } from '@/lib/ai/config'
import { AI_NOT_CONFIGURED_MESSAGE } from '@/lib/ai/messages'
import { getActiveScrapeJobId, runLabScrape } from '@/lib/labs/run-scrape'

export interface AdminScrapeLabResult {
  inserted: number
  skipped: number
  profileUpdated: boolean
  error: string | null
}

/**
 * Admin-only: scrape a lab's website, extract its profile + offered tests via
 * an LLM, and auto-save the results (fill empty profile fields + insert new
 * tests, 'approved' for an approved lab and 'pending' for a lab still waiting
 * for review). Expected failures are returned as `{ error }`;
 * only requireAdmin may throw (for non-admins). The actual pipeline lives in
 * {@link runLabScrape}, which throws on expected failures — this action
 * translates those throws into the `{ error }` contract.
 */
export async function adminScrapeLab(
  labId: string
): Promise<AdminScrapeLabResult> {
  await requireAdmin()

  if (!isAiConfigured()) {
    return { inserted: 0, skipped: 0, profileUpdated: false, error: AI_NOT_CONFIGURED_MESSAGE }
  }

  // Don't run alongside an in-flight durable scrape for the same lab — both
  // would race runLabScrape's non-atomic test dedupe and insert duplicate rows.
  if (await getActiveScrapeJobId(labId)) {
    return {
      inserted: 0,
      skipped: 0,
      profileUpdated: false,
      error: 'A scrape is already running for this lab. Please wait for it to finish.',
    }
  }

  try {
    const result = await runLabScrape({ labId })
    // Revalidate here (a real request/action context), not inside runLabScrape
    // (which also runs in the detached background job where it's unsupported).
    revalidatePath('/admin/labs')
    revalidatePath('/labs')
    return { ...result, error: null }
  } catch (err) {
    return {
      inserted: 0,
      skipped: 0,
      profileUpdated: false,
      error: err instanceof Error ? err.message : 'Scrape failed',
    }
  }
}
