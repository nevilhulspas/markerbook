import type { ClientProfile, Profile } from '@/lib/database.types'

/**
 * A profile row made safe to pass to a client component (and so into the page
 * HTML): drops the iPhone Shortcut token, which is a credential.
 */
export function toClientProfile(row: Profile): ClientProfile
export function toClientProfile(row: Profile | null): ClientProfile | null
export function toClientProfile(row: Profile | null): ClientProfile | null {
  if (!row) return null
  const { nutrition_log_token: _token, ...profile } = row
  return profile
}
