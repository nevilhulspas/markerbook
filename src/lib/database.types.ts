// Manual TypeScript types matching the Supabase database schema.
// These will be replaced by generated types when Supabase CLI type generation is set up.

export type Sex = 'male' | 'female' | 'other'

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active'

export type SampleType = 'serum' | 'plasma' | 'unknown'

// Optional medical-history fields. All nullable so existing profiles
// stay valid without backfill.
export type SmokingStatus = 'never' | 'former' | 'current'
export type PregnancyStatus =
  | 'not_pregnant'
  | 'pregnant'
  | 'breastfeeding'
  | 'not_applicable'
export type DietPattern =
  | 'omnivore'
  | 'pescatarian'
  | 'vegetarian'
  | 'vegan'
  | 'keto'
  | 'carnivore'
  | 'other'

export interface Profile {
  id: string
  // Optional display name shown in the sidebar user menu instead of the email.
  display_name?: string | null
  date_of_birth?: string | null
  sex?: Sex | null
  height_cm?: number | null
  weight_kg?: number | null
  activity_level?: ActivityLevel | null
  // Medical history additions (all optional)
  extra_notes?: string | null
  born_via_csection?: boolean | null
  breastfed_as_infant?: boolean | null
  smoking_status?: SmokingStatus | null
  alcohol_drinks_per_week?: number | null
  pregnancy_status?: PregnancyStatus | null
  known_allergies?: string | null
  family_history?: string | null
  diet_pattern?: DietPattern | null
  // Admin impersonation opt-in flag.
  impersonatable: boolean
  created_at: string
  updated_at: string
  // Nutrition — all optional/nullable, no backfill needed.
  nutrition_calorie_target?: number | null
  nutrition_protein_target_g?: number | null
  nutrition_carbs_target_g?: number | null
  nutrition_fat_target_g?: number | null
  nutrition_log_token?: string | null
}

/**
 * A profile as it may be sent to the browser: without the iPhone Shortcut
 * token, which is a credential and is only loaded on demand
 * (`getOrCreateLogToken`).
 */
export type ClientProfile = Omit<Profile, 'nutrition_log_token'>

// Previous/ongoing medical conditions (repeating list per user).
// NULL end_date means the condition is still active.
export interface MedicalCondition {
  id: string
  user_id: string
  condition_name: string
  start_date?: string | null
  end_date?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface ImpersonationSessionRow {
  id: string
  admin_user_id: string
  target_user_id: string
  started_at: string
  ended_at: string | null
}

export interface System {
  id: string
  name: string
  slug: string
  display_order: number
  created_at: string
}

export interface Panel {
  id: string
  system_id: string
  name: string
  short_name: string | null
  display_order: number
  created_at: string
}

export interface PanelWithSystem extends Panel {
  systems: System
}

export interface Biomarker {
  id: string
  name: string
  short_name: string | null
  category: string
  unit: string
  description: string | null
  ref_range_low: number | null
  ref_range_high: number | null
  ref_range_low_male: number | null
  ref_range_high_male: number | null
  ref_range_low_female: number | null
  ref_range_high_female: number | null
  range_source: 'curated' | 'report' | 'ai_estimated' | null
  aliases: string[]
  parent_id: string | null
  variant_name: string | null
  panel_id: string | null
  archived_at: string | null
  loinc_code: string | null
  /** g/mol, filled from LOINC (loinc_analytes) for mass <-> molar conversion. */
  molar_mass?: number | null
  /** Charge number, for mEq/L <-> mmol/L. */
  valence?: number | null
  /** The mass / molar unit labs use most for this substance (LOINC example units). */
  typical_mass_unit?: string | null
  typical_molar_unit?: string | null
  is_custom: boolean
  method: string | null
  created_at: string
  /** The user whose import or entry created this row; null for curated rows. */
  created_by?: string | null
}

/**
 * A row of `dutch_markers`. That table was created `LIKE biomarkers` before
 * `range_source` and `is_custom` were added to biomarkers, so it lacks both.
 */
export type DutchMarker = Omit<Biomarker, 'range_source' | 'is_custom'>

export interface BiomarkerUnit {
  id: string
  biomarker_id: string
  unit: string
  is_default: boolean
  conversion_factor: number
  created_at: string
}

export interface MarkerSuggestion {
  id: string
  user_id: string
  user_email?: string
  type: 'marker' | 'unit'
  name: string
  details: string | null
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  review_notes: string | null
  reviewed_at: string | null
  created_biomarker_id: string | null
  created_at: string
}

export interface ReferenceRange {
  id: string
  biomarker_id: string
  unit: string
  sex: 'male' | 'female' | 'general'
  age_min: number | null
  age_max: number | null
  range_low: number | null
  range_high: number | null
  source: string
  source_url: string | null
  verified_at: string | null
  verified_by: string | null
  range_type: 'normal' | 'optimal'
  phase: string | null
  created_at: string
}

export interface BloodTest {
  id: string
  user_id: string
  name: string
  test_date: string
  sample_type: SampleType
  notes: string | null
  pdf_storage_path: string | null
  created_at: string
  updated_at: string
}

export interface TestResult {
  id: string
  blood_test_id: string
  biomarker_id: string
  value: number
  /** '<' / '<=' / '>' / '>=' for a result such as "<0.5"; null for a plain value. */
  qualifier: string | null
  unit: string
  created_at: string
}

export interface Annotation {
  id: string
  user_id: string
  title: string
  body: string | null
  date: string
  end_date: string | null
  created_at: string
  updated_at: string
}

export type SupplementFrequency = 'daily' | 'twice_daily' | 'weekly' | 'as_needed' | 'other'

export interface Supplement {
  id: string
  user_id: string
  name: string
  dose: string | null
  frequency: string | null
  start_date: string
  end_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** A row of `supplement_intakes`. `time_of_day` is Postgres TIME ("08:00:00"). */
export interface SupplementIntakeRow {
  id: string
  supplement_id: string
  user_id: string
  time_of_day: string
  amount: string | null
  created_at: string
}

/** An intake moment in app form: `time` normalized to "HH:MM". */
export interface SupplementIntake {
  time: string
  amount: string | null
}

export interface SupplementWithIntakes extends Supplement {
  intakes: SupplementIntake[]
}

export interface WishlistItem {
  id: string
  user_id: string
  name: string
  priority: 'high' | 'medium' | 'low' | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface WishlistSource {
  id: string
  item_id: string
  user_id: string
  brand: string | null
  url: string | null
  price: number | null
  currency: string | null
  created_at: string
}

export type WishlistItemWithSources = WishlistItem & { sources: WishlistSource[] }

export interface ChatThread {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ChatAttachment {
  storagePath: string
  mediaType: string
  filename: string
  /** Storage paths of the file's pieces. A normal upload has a single piece
   *  (== storagePath); a long image split into page tiles has several. Consumers
   *  should iterate `parts ?? [storagePath]`. */
  parts?: string[]
  /** Signed URL for viewing — populated on read (getThreadMessages), not stored. */
  url?: string
}

export interface ChatMessageRow {
  id: string
  thread_id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_invocations: unknown | null
  attachments: ChatAttachment[] | null
  created_at: string
}

export interface ChatDocumentExtractionRow {
  id: string
  user_id: string
  thread_id: string
  storage_path: string
  document_type: string
  extraction: unknown
  created_at: string
}

export interface GeneticProfile {
  id: string
  user_id: string
  source: string | null
  import_date: string
  file_storage_path: string | null
  snp_count: number
  created_at: string
}

// DUTCH Test types

export type MenstrualPhase =
  | 'follicular'
  | 'luteal'
  | 'postmenopausal'
  | 'oral_progesterone'
  | 'oral_contraceptive'
  | 'male'
  | 'unknown'

export type DutchTimepoint = 'waking' | 'morning' | 'afternoon' | 'night'

export interface DutchTest {
  id: string
  user_id: string
  name: string
  test_date: string
  menstrual_phase: MenstrualPhase | null
  cycle_day: number | null
  notes: string | null
  pdf_storage_path: string | null
  created_at: string
  updated_at: string
}

export interface DutchTestResult {
  id: string
  dutch_test_id: string
  biomarker_id: string
  value: number
  unit: string
  timepoint: DutchTimepoint | null
  created_at: string
}

export interface DutchComputedValue {
  id: string
  dutch_test_id: string
  name: string
  value: number
  unit: string
  formula: string | null
  source_marker_ids: string[] | null
  created_at: string
}

export interface SnpVariant {
  id: string
  genetic_profile_id: string
  rsid: string
  chromosome: string | null
  position: number | null
  genotype: string
  gene_name: string | null
  variant_name: string | null
  clinical_significance: string | null
  category: string | null
  created_at: string
}

export interface RnaTest {
  id: string
  user_id: string
  name: string
  test_date: string
  source: string | null
  file_storage_path: string | null
  created_at: string
}

export interface RnaExpression {
  id: string
  rna_test_id: string
  gene_name: string
  expression_value: number | null
  unit: string | null
  fold_change: number | null
  p_value: number | null
  status: string | null
  created_at: string
}


export type MicrobiomeRank =
  | 'kingdom'
  | 'phylum'
  | 'class'
  | 'order'
  | 'family'
  | 'genus'
  | 'species'
  | 'strain'
  | 'functional_group'

export type MicrobiomeCategory =
  | 'beneficial'
  | 'commensal'
  | 'opportunistic'
  | 'pathogenic'
  | 'unknown'

export type MicrobiomeStatus = 'low' | 'normal' | 'high' | 'unknown'

export interface MicrobiomeTaxon {
  id: string
  name: string
  rank: MicrobiomeRank
  parent_id: string | null
  aliases: string[]
  category: MicrobiomeCategory | null
  description: string | null
  created_at: string
}

export interface MicrobiomeTest {
  id: string
  user_id: string
  name: string
  test_date: string
  lab_name: string | null
  sample_type: string | null
  notes: string | null
  pdf_storage_path: string | null
  created_at: string
  updated_at: string
}

export interface MicrobiomeResult {
  id: string
  microbiome_test_id: string
  taxon_id: string
  value: number | null
  unit: string | null
  ref_low: number | null
  ref_high: number | null
  status: MicrobiomeStatus | null
  raw_label: string | null
  created_at: string
}

export interface MicrobiomeScore {
  id: string
  microbiome_test_id: string
  name: string
  value: number
  unit: string | null
  ref_low: number | null
  ref_high: number | null
  status: MicrobiomeStatus | null
  description: string | null
  created_at: string
}

// Lab directory (Phase 1)
export type LabStatus = 'pending' | 'approved' | 'rejected'

export interface Lab {
  id: string
  name: string
  country: string | null
  city: string | null
  website: string | null
  description: string | null
  status: LabStatus
  submitted_by: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
}

export interface LabTest {
  id: string
  lab_id: string
  name: string
  method: string | null
  cost: number | null
  currency: string | null
  turnaround_days: number | null
  sample_type: string | null
  /**
   * If this test is outsourced to a partner reference lab, the analyzing lab's
   * name (e.g. "Biovis Diagnostik MVZ GmbH"). Null when analyzed in-house.
   * Exposed to the AI lab-test tools so the model can weight specialty value.
   */
  provider: string | null
  notes: string | null
  status: LabStatus
  submitted_by: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
}

export interface LabTestBiomarker {
  lab_test_id: string
  biomarker_id: string
}

export interface LabFavorite {
  id: string
  user_id: string
  lab_id: string
  created_at: string
}

export type ScrapeJobStatus = 'running' | 'done' | 'error'

export interface ScrapeJob {
  id: string
  lab_id: string
  status: ScrapeJobStatus
  logs: string
  inserted: number
  skipped: number
  profile_updated: boolean
  error: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Body Comp — DEXA scans (Phase 1)
// ---------------------------------------------------------------------------

export type DexaRegionName =
  | 'arms' | 'arm_left' | 'arm_right'
  | 'legs' | 'leg_left' | 'leg_right'
  | 'trunk' | 'trunk_left' | 'trunk_right'
  | 'android' | 'gynoid' | 'total'
  | 'head' | 'ribs' | 'spine' | 'pelvis'

export type BodyMetricKey =
  | 'body_fat_pct' | 'lean_mass_kg' | 'total_mass_kg' | 'visceral_fat_g'
  | 'ffmi' | 'almi' | 'bone_t_score'

export interface DexaScan {
  id: string
  user_id: string
  scan_date: string
  provider: string | null
  age_years: number | null
  height_cm: number | null
  weight_kg: number | null
  total_mass_kg: number | null
  fat_mass_g: number | null
  lean_mass_g: number | null
  bmc_g: number | null
  body_fat_pct: number | null
  visceral_fat_g: number | null
  android_fat_pct: number | null
  gynoid_fat_pct: number | null
  android_gynoid_ratio: number | null
  almi: number | null
  ffmi: number | null
  bone_t_score: number | null
  bone_z_score: number | null
  total_bmd: number | null
  source: 'summary' | 'raw' | 'manual' | 'merged'
  notes: string | null
  pdf_storage_path: string | null
  created_at: string
  updated_at: string
}

export interface DexaRegion {
  id: string
  scan_id: string
  region: DexaRegionName
  fat_pct: number | null
  fat_mass_g: number | null
  lean_mass_g: number | null
  bmc_g: number | null
  total_mass_g: number | null
  bmd: number | null
  t_score: number | null
  z_score: number | null
}

// RMR (resting metabolic rate) tests. Twin of dexa_scans, RLS by
// user_id. Hand-written until Supabase type generation is set up (see
// CLAUDE.md). TDEE/calorie targets are derived (src/lib/rmr/tdee.ts), not stored.
export interface RmrTest {
  id: string
  user_id: string
  test_date: string
  provider: string | null
  rmr_kcal: number
  predicted_rmr_kcal: number | null
  rer: number | null
  fuel_carb_pct: number | null
  fuel_fat_pct: number | null
  source: 'import' | 'manual' | 'summary'
  notes: string | null
  pdf_storage_path: string | null
  created_at: string
  updated_at: string
}

// Generic "Other tests" bucket — misc / near-binary tests (SIBO, intolerance
// panels, pathogen screens) that don't warrant a dedicated per-type pipeline.
export type OtherTestOutcome =
  | 'positive'
  | 'negative'
  | 'normal'
  | 'abnormal'
  | 'inconclusive'
  | 'not_applicable'

export interface OtherTest {
  id: string
  user_id: string
  test_name: string
  test_date: string
  provider: string | null
  outcome: OtherTestOutcome
  result_summary: string | null
  notes: string | null
  interpretation: string | null
  interpreted_at: string | null
  source: 'import' | 'manual' | 'summary'
  pdf_storage_path: string | null
  created_at: string
  updated_at: string
}

export interface OtherTestValue {
  id: string
  test_id: string
  label: string
  value: string | null
  unit: string | null
  flag: string | null
  sort_order: number
}

export type OtherTestWithValues = OtherTest & { values: OtherTestValue[] }

export interface BodyGoal {
  id: string
  user_id: string
  metric: BodyMetricKey
  target_value: number
  updated_at: string
}

export interface BodyLogEntry {
  id: string
  user_id: string
  logged_on: string
  weight_kg: number | null
  body_fat_pct: number | null
  waist_cm: number | null
  notes: string | null
  created_at: string
}

export interface NextToTestList {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
}

export type NextToTestStatus = 'pending' | 'done'

// Discriminator for the test category. Blood markers and lab tests
// still carry biomarker_id / lab_test_id; the four typed non-blood categories
// (dexa / microbiome / dutch / genetic) and 'other' use custom_name for the
// display label. Enforced by the next_to_test_kind_chk CHECK constraint.
export type NextToTestType =
  | 'blood_biomarker'
  | 'blood_lab_test'
  | 'dexa'
  | 'microbiome'
  | 'dutch'
  | 'genetic'
  | 'other'

export interface NextToTest {
  id: string
  user_id: string
  list_id: string
  test_type: NextToTestType
  biomarker_id: string | null
  lab_test_id: string | null
  custom_name: string | null
  note: string | null
  due_date: string | null
  status: NextToTestStatus
  created_at: string
  updated_at: string
}

// --- Nutrition --------------------------------------------------------------

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealType = (typeof MEAL_TYPES)[number]
export type FoodSource = 'app' | 'voice' | 'shortcut' | 'import' | 'migration' | 'photo'

export interface FoodLog {
  id: string
  user_id: string
  entry_date: string
  raw_input: string | null
  food_name: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  sugar_g: number | null
  sodium_mg: number | null
  saturated_fat_g: number | null
  meal_type: MealType | null
  notes: string | null
  source: FoodSource
  is_deleted: boolean
  created_at: string
  updated_at: string
  // Phase 1.5: per-item columns
  grams: number | null
  match_source: MatchSource | null
  match_ref: string | null
  recipe_id: string | null
  custom_food_id: string | null
  submission_id: string | null
  image_path: string | null
  weight_estimated: boolean
}

// --- Nutrition Phase 1.5 types -------------------------------------------

export type MatchSource =
  | 'nevo'
  | 'off'
  | 'custom_food'
  | 'recipe'
  | 'estimate'
  | 'manual'
  | 'legacy_usda'

export interface CustomFood {
  id: string
  user_id: string
  name: string
  brand: string | null
  kcal_per_100g: number | null
  protein_per_100g: number | null
  carbs_per_100g: number | null
  fat_per_100g: number | null
  fiber_per_100g: number | null
  sugar_per_100g: number | null
  sodium_mg_per_100g: number | null
  sat_fat_per_100g: number | null
  default_grams: number
  notes: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface Recipe {
  id: string
  user_id: string
  name: string
  notes: string | null
  total_grams: number
  total_kcal: number
  total_protein: number
  total_carbs: number
  total_fat: number
  total_fiber: number
  total_sugar: number
  total_sodium_mg: number
  total_sat_fat: number
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface RecipeIngredient {
  id: string
  recipe_id: string
  position: number
  nevo_code: string | null
  off_barcode: string | null
  custom_food_id: string | null
  raw_name: string | null
  grams: number
  kcal_per_100g: number | null
  protein_per_100g: number | null
  carbs_per_100g: number | null
  fat_per_100g: number | null
  fiber_per_100g: number | null
  sugar_per_100g: number | null
  sodium_mg_per_100g: number | null
  sat_fat_per_100g: number | null
}

export interface NevoFood {
  nevo_code: string
  name_nl: string
  name_en: string | null
  synonyms: string | null
  food_group_nl: string | null
  food_group_en: string | null
  kcal_per_100g: number | null
  protein_per_100g: number | null
  carbs_per_100g: number | null
  fat_per_100g: number | null
  fiber_per_100g: number | null
  sugar_per_100g: number | null
  sodium_mg_per_100g: number | null
  sat_fat_per_100g: number | null
  search_text: string
}
