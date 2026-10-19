'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { microbiomeTestSchema } from '@/lib/validations/microbiome-test'
import type {
  MicrobiomeResult,
  MicrobiomeScore,
  MicrobiomeTaxon,
  MicrobiomeTest,
} from '@/lib/database.types'

export interface MicrobiomeTestWithCount extends MicrobiomeTest {
  result_count: number
}

export interface MicrobiomeResultWithTaxon extends MicrobiomeResult {
  microbiome_taxa: MicrobiomeTaxon
}

export interface MicrobiomeTestDetail extends MicrobiomeTest {
  microbiome_results: MicrobiomeResultWithTaxon[]
  microbiome_scores: MicrobiomeScore[]
}

export async function getMicrobiomeTests(): Promise<
  | { data: MicrobiomeTestWithCount[]; error: null }
  | { data: null; error: string }
> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) return { data: null, error: authError ?? 'Not authenticated' }

  const { data, error } = await supabase
    .from('microbiome_tests')
    .select('*, microbiome_results(id)')
    .order('test_date', { ascending: false })

  if (error) return { data: null, error: error.message }

  const tests: MicrobiomeTestWithCount[] = (data ?? []).map((row) => {
    const { microbiome_results, ...rest } = row
    return {
      ...(rest as MicrobiomeTest),
      result_count: Array.isArray(microbiome_results)
        ? microbiome_results.length
        : 0,
    }
  })

  return { data: tests, error: null }
}

export async function getMicrobiomeTestDetail(
  id: string
): Promise<
  | { data: MicrobiomeTestDetail; error: null }
  | { data: null; error: string }
> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) return { data: null, error: authError ?? 'Not authenticated' }

  const { data, error } = await supabase
    .from('microbiome_tests')
    .select(
      '*, microbiome_results(*, microbiome_taxa(*)), microbiome_scores(*)'
    )
    .eq('id', id)
    .single()

  if (error || !data) {
    return { data: null, error: error?.message ?? 'Test not found' }
  }

  // Narrowing cast: the hand-written microbiome types are stricter than the schema.
  return { data: data as MicrobiomeTestDetail, error: null }
}

export async function updateMicrobiomeTest(
  id: string,
  values: unknown
): Promise<{ success: boolean; error: string | null }> {
  const parsed = microbiomeTestSchema.safeParse(values)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    return { success: false, error: `Invalid: ${issues}` }
  }

  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { success: false, error: authError ?? 'Not authenticated' }

  const { data: existing } = await supabase
    .from('microbiome_tests')
    .select('id')
    .eq('id', id)
    .single()
  if (!existing) return { success: false, error: 'Test not found' }

  const { error } = await supabaseAdmin
    .from('microbiome_tests')
    .update({
      name: parsed.data.name,
      test_date: parsed.data.test_date,
      lab_name: parsed.data.lab_name ?? null,
      sample_type: parsed.data.sample_type ?? null,
      notes: parsed.data.notes ?? null,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/microbiome')
  revalidatePath(`/microbiome/${id}`)
  return { success: true, error: null }
}

export async function deleteMicrobiomeTest(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { success: false, error: authError ?? 'Not authenticated' }

  const { data: existing } = await supabase
    .from('microbiome_tests')
    .select('id')
    .eq('id', id)
    .single()
  if (!existing) return { success: false, error: 'Test not found' }

  const { error } = await supabaseAdmin
    .from('microbiome_tests')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/microbiome')
  return { success: true, error: null }
}
