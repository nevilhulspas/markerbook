import type { ActivityLevel } from '@/lib/validations/profile'

// TDEE = RMR * activity multiplier. These multipliers reproduce the DexaFit
// TDEE table exactly (e.g. 2229 x 1.2 = 2675, x 1.55 = 3455, x 1.9 = 4235).
// Order matches the profile activity_level enum.
export const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

/** Total daily energy expenditure for a measured RMR at an activity level. */
export function tdee(rmrKcal: number, level: ActivityLevel): number {
  return Math.round(rmrKcal * ACTIVITY_MULTIPLIER[level])
}

/** Fat-loss calorie range: a 500-1000 kcal/day deficit from TDEE. */
export function fatLossRange(tdeeKcal: number): [number, number] {
  return [tdeeKcal - 1000, tdeeKcal - 500]
}

/** Lean-gain calorie range: a 250-500 kcal/day surplus over TDEE. */
export function leanGainRange(tdeeKcal: number): [number, number] {
  return [tdeeKcal + 250, tdeeKcal + 500]
}
