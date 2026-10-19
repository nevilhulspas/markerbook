import { createClient } from '@/lib/supabase/server'
import { buildOtherInterpretPrompt } from '@/lib/other/interpret-prompt'
import { formatProfile } from '@/lib/interpretation/prompt'
import type { ProfileContext } from '@/lib/interpretation/types'
import type { OtherTest, OtherTestValue, Profile } from '@/lib/database.types'
import { getAnthropic } from '@/lib/ai/client'
import { REASONING_MODEL } from '@/lib/ai/models'
import { toTextStreamResponse } from '@/lib/ai/text-stream-response'
import { aiLimitResponse, takeAiRequest } from '@/lib/ai/quota'

/** Map a profiles row to the ProfileContext shape formatProfile() expects. */
function toProfileContext(p: Profile | null): ProfileContext {
  if (!p) return {}
  return {
    dateOfBirth: p.date_of_birth ?? null,
    sex: p.sex ?? null,
    heightCm: p.height_cm ?? null,
    weightKg: p.weight_kg ?? null,
    activityLevel: p.activity_level ?? null,
    extraNotes: p.extra_notes ?? null,
    bornViaCsection: p.born_via_csection ?? null,
    breastfedAsInfant: p.breastfed_as_infant ?? null,
    smokingStatus: p.smoking_status ?? null,
    alcoholDrinksPerWeek: p.alcohol_drinks_per_week ?? null,
    pregnancyStatus: p.pregnancy_status ?? null,
    knownAllergies: p.known_allergies ?? null,
    familyHistory: p.family_history ?? null,
    dietPattern: p.diet_pattern ?? null,
  }
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: { testId?: string }
  try {
    body = (await request.json()) as { testId?: string }
  } catch {
    return new Response('Invalid request body', { status: 400 })
  }
  if (!body.testId) return new Response('Missing testId', { status: 400 })

  // RLS scopes both reads to the owner — a non-owner gets null and a 404.
  const { data: testRow } = await supabase
    .from('other_tests')
    .select('*, values:other_test_values(*)')
    .eq('id', body.testId)
    .maybeSingle()
  if (!testRow) return new Response('Test not found', { status: 404 })

  const quota = await takeAiRequest(user.id)
  if (!quota.ok) return aiLimitResponse(quota.error)

  const test = testRow as OtherTest & { values: OtherTestValue[] }
  const values = [...(test.values ?? [])].sort((a, b) => a.sort_order - b.sort_order)

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const prompt = buildOtherInterpretPrompt({
    test,
    values,
    profileText: formatProfile(toProfileContext(profileRow as Profile | null)),
  })

  // Adaptive thinking + high effort — mirrors /api/interpret (see comment there).
  const stream = getAnthropic().messages.stream({
    model: REASONING_MODEL,
    max_tokens: 64000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  })

  return toTextStreamResponse(stream)
}
