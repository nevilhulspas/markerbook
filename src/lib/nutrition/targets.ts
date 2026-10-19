import type { ActivityLevel, Profile } from '@/lib/database.types'

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

// NOTE: date-only DOB strings parse as UTC midnight; in extreme western timezones
// the birthday threshold can be off by one day. Acceptable for a BMR estimate.
export function ageFromDob(dob: string | null | undefined, now: Date = new Date()): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  let age = now.getFullYear() - d.getFullYear()
  const monthDiff = now.getMonth() - d.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d.getDate())) age--
  return age
}

type TargetProfile = Pick<
  Profile,
  'sex' | 'height_cm' | 'weight_kg' | 'activity_level' | 'date_of_birth'
>

/** Mifflin–St Jeor TDEE + 1.6 g/kg protein. Null if profile lacks the inputs. */
export function suggestTargetsFromProfile(
  profile: TargetProfile | null,
  now: Date = new Date()
): { calories: number; protein_g: number } | null {
  if (!profile) return null
  const { sex, height_cm, weight_kg, activity_level } = profile
  const age = ageFromDob(profile.date_of_birth, now)
  if (!height_cm || !weight_kg || age == null || (sex !== 'male' && sex !== 'female')) {
    return null
  }
  const bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + (sex === 'male' ? 5 : -161)
  const factor = ACTIVITY_FACTOR[(activity_level as ActivityLevel) ?? 'moderate'] ?? 1.55
  const calories = Math.round((bmr * factor) / 100) * 100
  const protein_g = Math.round(1.6 * weight_kg)
  return { calories, protein_g }
}
