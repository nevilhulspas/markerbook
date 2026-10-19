import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'

export const AI_LIMIT_REACHED =
  'You have reached the AI usage limit for now. Please try again later.'

function limitFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === '') return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : fallback
}

/** Per-user AI request limits. Set either to 0 to switch that limit off. */
export function aiLimits(): { perHour: number; perDay: number } {
  return {
    perHour: limitFromEnv('AI_REQUESTS_PER_HOUR', 60),
    perDay: limitFromEnv('AI_REQUESTS_PER_DAY', 300),
  }
}

/**
 * Record one AI request for `userId` if the user is under the limits.
 * Call it after authentication and before the model call. Fails closed: if
 * the check itself fails, the request is refused.
 */
export async function takeAiRequest(
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { perHour, perDay } = aiLimits()
  if (perHour <= 0 && perDay <= 0) return { ok: true }
  const { data, error } = await supabaseAdmin.rpc('take_ai_request', {
    p_user_id: userId,
    p_per_hour: perHour,
    p_per_day: perDay,
  })
  if (error) {
    console.error('takeAiRequest failed:', error.message)
    return { ok: false, error: 'Could not check your AI usage. Please try again.' }
  }
  return data === true ? { ok: true } : { ok: false, error: AI_LIMIT_REACHED }
}

/**
 * The response for API routes that hit the limit. Plain text, like the
 * routes' other early errors, because the streaming clients show the body.
 */
export function aiLimitResponse(error: string): Response {
  return new Response(error, { status: error === AI_LIMIT_REACHED ? 429 : 503 })
}
