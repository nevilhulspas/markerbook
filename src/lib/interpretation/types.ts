export type InterpretationType = 'single_marker' | 'full_test' | 'biomarker_insight'

export interface MarkerContext {
  name: string
  shortName: string | null
  value: number
  unit: string
  category: string
  refRangeLow: number | null
  refRangeHigh: number | null
  status: string
}

export interface ProfileContext {
  dateOfBirth?: string | null
  sex?: string | null
  heightCm?: number | null
  weightKg?: number | null
  activityLevel?: string | null
  // AUT-854: optional medical-history fields. All flow into the chat system
  // prompt's `## User Profile` block via formatProfile().
  extraNotes?: string | null
  bornViaCsection?: boolean | null
  breastfedAsInfant?: boolean | null
  smokingStatus?: 'never' | 'former' | 'current' | null
  alcoholDrinksPerWeek?: number | null
  pregnancyStatus?:
    | 'not_pregnant'
    | 'pregnant'
    | 'breastfeeding'
    | 'not_applicable'
    | null
  knownAllergies?: string | null
  familyHistory?: string | null
  dietPattern?:
    | 'omnivore'
    | 'pescatarian'
    | 'vegetarian'
    | 'vegan'
    | 'keto'
    | 'carnivore'
    | 'other'
    | null
  medicalConditions?: Array<{
    name: string
    startDate?: string | null
    endDate?: string | null // null = ongoing
    notes?: string | null
  }>
}

export interface InterpretationRequest {
  type: InterpretationType
  userId: string
  bloodTestId: string
  testResultId?: string
  markerName: string
  markerValue?: number
  markerUnit?: string
  refRangeLow?: number | null
  refRangeHigh?: number | null
  status?: string
  allTestResults: MarkerContext[]
  profile: ProfileContext
  historicalValues?: Array<{ date: string; value: number; unit?: string; testName: string }>
}

export interface MarkerHistoryEntry {
  name: string
  shortName: string | null
  category: string
  history: Array<{
    testDate: string
    testName: string
    value: number
    unit: string
    status: string
  }>
}

export interface SupplementContext {
  name: string
  dose: string | null
  frequency: string | null
  startDate: string
  endDate: string | null
  /** Intake moments: "HH:MM" plus how much is taken then. */
  intakes?: { time: string; amount: string | null }[]
}

export interface CachedInterpretation {
  id: string
  user_id: string
  blood_test_id: string
  test_result_id: string | null
  type: InterpretationType
  content: string
  profile_hash: string
  marker_context_hash: string
  model: string
  created_at: string
}
