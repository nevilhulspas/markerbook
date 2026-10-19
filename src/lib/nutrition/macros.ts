// Pure, dependency-free macro helpers. Client components import from HERE —
// match.ts pulls in the Anthropic SDK at module scope and must stay server-only.

export interface Macros100 {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodium_mg: number
  sat_fat: number
}

/** Scale per-100g macros to an actual gram amount. */
export function scaleTo(per100g: Macros100, grams: number): Macros100 {
  const k = grams / 100
  return {
    kcal: per100g.kcal * k,
    protein: per100g.protein * k,
    carbs: per100g.carbs * k,
    fat: per100g.fat * k,
    fiber: per100g.fiber * k,
    sugar: per100g.sugar * k,
    sodium_mg: per100g.sodium_mg * k,
    sat_fat: per100g.sat_fat * k,
  }
}

/** Recover per-100g macros from an absolute snapshot taken at `grams`.
 *  Inverse of scaleTo; returns the snapshot unchanged when grams ≤ 0. */
export function per100From(macros: Macros100, grams: number): Macros100 {
  if (!(grams > 0)) return { ...macros }
  const k = 100 / grams
  return {
    kcal: macros.kcal * k,
    protein: macros.protein * k,
    carbs: macros.carbs * k,
    fat: macros.fat * k,
    fiber: macros.fiber * k,
    sugar: macros.sugar * k,
    sodium_mg: macros.sodium_mg * k,
    sat_fat: macros.sat_fat * k,
  }
}

/** A recipe's denormalized totals as stored on `recipes` (plus its name). */
export interface RecipeTotals {
  name: string
  total_grams: number
  total_kcal: number
  total_protein: number
  total_carbs: number
  total_fat: number
  total_fiber: number
  total_sugar: number
  total_sodium_mg: number
  total_sat_fat: number
}

/** The `food_logs` columns a retroactive recipe edit rewrites. */
export interface LoggedEntryPatch {
  food_name: string
  grams: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sugar_g: number
  sodium_mg: number
  saturated_fat_g: number
}

/**
 * Re-derive a logged entry's macro snapshot against new recipe totals,
 * preserving the entry's portion (logged grams ÷ OLD recipe total grams —
 * `food_logs` stores no servings column; this mirrors the derivation the
 * food-log edit dialog already uses via getRecipeSummary).
 * Returns null when the portion is not derivable.
 */
export function rescaleLoggedEntry(
  loggedGrams: number | null,
  oldTotalGrams: number,
  next: RecipeTotals,
): LoggedEntryPatch | null {
  if (loggedGrams == null || loggedGrams < 0 || !(oldTotalGrams > 0)) return null
  const servings = loggedGrams / oldTotalGrams
  return {
    food_name: next.name,
    grams: next.total_grams * servings,
    calories: next.total_kcal * servings,
    protein_g: next.total_protein * servings,
    carbs_g: next.total_carbs * servings,
    fat_g: next.total_fat * servings,
    fiber_g: next.total_fiber * servings,
    sugar_g: next.total_sugar * servings,
    sodium_mg: next.total_sodium_mg * servings,
    saturated_fat_g: next.total_sat_fat * servings,
  }
}
