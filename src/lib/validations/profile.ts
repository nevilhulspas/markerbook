import { z } from 'zod'

// AUT-854: medical-history additions are all optional. We keep these as plain
// `z.string().optional()` (no `z.preprocess`) so the inferred form-values type
// stays compatible with react-hook-form's Resolver. The form's onSubmit
// trims/strips empty strings before calling the server action; the server
// action also coerces empty strings to undefined defensively.
export const profileSchema = z
  .object({
    // .nullable() so the form can send `null` to clear a previously set name;
    // the transform coerces a bare empty string to null so direct callers
    // can't store '' (the form already does this client-side).
    display_name: z
      .string()
      .trim()
      .max(200, 'Name too long')
      .transform((v) => v || null)
      .nullable(),
    date_of_birth: z.string().date('Please enter a valid date'),
    sex: z.enum(['male', 'female', 'other']),
    height_cm: z
      .number()
      .min(50, 'Height must be at least 50 cm')
      .max(300, 'Height must be at most 300 cm'),
    weight_kg: z
      .number()
      .min(20, 'Weight must be at least 20 kg')
      .max(500, 'Weight must be at most 500 kg'),
    activity_level: z.enum([
      'sedentary',
      'light',
      'moderate',
      'active',
      'very_active',
    ]),
    // AUT-854 — medical history (all optional)
    extra_notes: z.string().max(5000).optional(),
    // .nullable() rather than just .optional() — UI uses an explicit
    // yes/no/unknown tri-state and writes `null` for "unknown".
    born_via_csection: z.boolean().nullable().optional(),
    breastfed_as_infant: z.boolean().nullable().optional(),
    smoking_status: z.enum(['never', 'former', 'current']).optional(),
    alcohol_drinks_per_week: z
      .number()
      .min(0, 'Cannot be negative')
      .max(200, 'That seems unrealistically high')
      .optional(),
    pregnancy_status: z
      .enum([
        'not_pregnant',
        'pregnant',
        'breastfeeding',
        // Explicit opt-out for users the field doesn't apply to (e.g. men).
        // Distinct from undefined so the picker shows their conscious choice.
        'not_applicable',
      ])
      .optional(),
    known_allergies: z.string().max(5000).optional(),
    family_history: z.string().max(5000).optional(),
    diet_pattern: z
      .enum([
        'omnivore',
        'pescatarian',
        'vegetarian',
        'vegan',
        'keto',
        'carnivore',
        'other',
      ])
      .optional(),
  })
  .partial()

export type ProfileFormValues = z.infer<typeof profileSchema>

// Activity level enum (kept in the exact order the profile schema defines it):
// sedentary | light | moderate | active | very_active. Used by RMR -> TDEE math.
export type ActivityLevel = NonNullable<ProfileFormValues['activity_level']>

// AUT-854: medical_conditions CRUD. start_date/end_date are optional strings;
// the server action coerces empty strings to null before insert/update.
// Cross-field check: when both dates are present, end must be ≥ start
// (DB enforces the same constraint).
export const medicalConditionSchema = z
  .object({
    // Trim before length check so whitespace-only input fails validation.
    condition_name: z
      .string()
      .trim()
      .min(1, 'Condition name is required')
      .max(200, 'Name too long'),
    start_date: z
      .union([z.string().date('Invalid start date'), z.literal('')])
      .optional(),
    end_date: z
      .union([z.string().date('Invalid end date'), z.literal('')])
      .optional(),
    notes: z.string().max(5000).optional(),
  })
  .refine(
    (v) => !v.start_date || !v.end_date || v.end_date >= v.start_date,
    { message: 'End date must be on or after start date', path: ['end_date'] }
  )

export type MedicalConditionFormValues = z.infer<typeof medicalConditionSchema>
