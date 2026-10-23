'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { userErrorMessage } from '@/lib/supabase/errors'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { profileSchema } from '@/lib/validations/profile'
import type { ClientProfile, Profile } from '@/lib/database.types'
import { toClientProfile } from '@/lib/profile/client-profile'

export async function getProfile(): Promise<
  { data: ClientProfile; error: null } | { data: null; error: string }
> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { data: null, error: authError ?? 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    return {
      data: null,
      error: userErrorMessage(
        'getProfile',
        error,
        'Could not load your profile. Please try again.'
      ),
    }
  }

  // The page passes this row to client components, so it ends up in the HTML.
  return { data: toClientProfile(data as Profile), error: null }
}

export async function updateProfile(
  values: unknown
): Promise<{ success: true; error: null } | { success: false; error: string }> {
  const parsed = profileSchema.safeParse(values)
  if (!parsed.success) {
    return { success: false, error: 'Invalid profile data' }
  }

  const { user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, error: authError ?? 'Not authenticated' }
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    return {
      success: false,
      error: userErrorMessage(
        'updateProfile',
        error,
        'Could not save your profile. Please try again.'
      ),
    }
  }

  revalidatePath('/profile')
  return { success: true, error: null }
}
