import { tool } from 'ai'
import { z } from 'zod'
import type { TypedSupabaseClient } from '@/lib/supabase/database'
import type { TableUpdate } from '@/lib/supabase/database'
import { omitUndefined } from '@/lib/object/omit-undefined'

// Chat tools for the Health Profile screen: personal info + health context
// (one `profiles` row) and the medical-conditions list. These mirror the
// server actions in @/actions/profile and @/actions/medical-conditions, but
// run against the service-role client the chat route already holds, scoped to
// the caller's user_id (same pattern as health-record-tools).

const emptyToNull = (v: string | null | undefined) =>
  v == null || v.trim() === '' ? null : v

// The editable profile columns, with model-facing descriptions. Every field is
// optional so the model sends only what it's changing. Mirrors profileSchema.
const profileFields = {
  display_name: z.string().max(200).nullable().describe('Preferred name.'),
  date_of_birth: z.string().date().describe('YYYY-MM-DD.'),
  sex: z.enum(['male', 'female', 'other']),
  height_cm: z.number().min(50).max(300),
  weight_kg: z.number().min(20).max(500),
  activity_level: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  smoking_status: z.enum(['never', 'former', 'current']),
  alcohol_drinks_per_week: z.number().min(0).max(200),
  diet_pattern: z.enum([
    'omnivore', 'pescatarian', 'vegetarian', 'vegan', 'keto', 'carnivore', 'other',
  ]),
  pregnancy_status: z.enum(['not_pregnant', 'pregnant', 'breastfeeding', 'not_applicable']),
  // tri-state: true/false, or null for "unknown".
  born_via_csection: z.boolean().nullable().describe('null = unknown.'),
  breastfed_as_infant: z.boolean().nullable().describe('null = unknown.'),
  known_allergies: z.string().max(5000).describe('Free text.'),
  family_history: z.string().max(5000).describe('Free text.'),
  extra_notes: z.string().max(5000).describe('"Anything else the AI should know" free text.'),
} as const

export function createProfileTools(supabase: TypedSupabaseClient, userId: string) {
  return {
    // -- Profile + health context -------------------------------------------

    get_profile: tool({
      description:
        "Read the user's health profile: personal info (name, date of birth, sex, height, weight, activity level) plus health context (smoking, alcohol, diet, pregnancy status, born-via-c-section, breastfed, known allergies, family history, extra notes) and their medical-conditions list. Freely callable — call before editing so you don't overwrite fields you didn't mean to.",
      inputSchema: z.object({}),
      execute: async () => {
        const [{ data: profile, error: pErr }, { data: conditions, error: cErr }] =
          await Promise.all([
            supabase
              .from('profiles')
              .select(
                'id, display_name, date_of_birth, sex, height_cm, weight_kg, activity_level, smoking_status, alcohol_drinks_per_week, diet_pattern, pregnancy_status, born_via_csection, breastfed_as_infant, known_allergies, family_history, extra_notes, updated_at'
              )
              .eq('id', userId)
              .maybeSingle(),
            supabase
              .from('medical_conditions')
              .select('id, condition_name, start_date, end_date, notes')
              .eq('user_id', userId)
              .order('start_date', { ascending: false, nullsFirst: false }),
          ])
        if (pErr) return { error: pErr.message }
        if (cErr) return { error: cErr.message }
        return { profile: profile ?? null, medical_conditions: conditions ?? [] }
      },
    }),

    update_profile: tool({
      description:
        "Update the user's health profile — personal info AND/OR health context. Only the fields you pass change; everything else is left as-is. For born_via_csection / breastfed_as_infant pass null to mean 'unknown'. To clear a free-text field, pass an empty string.",
      inputSchema: z.object(
        Object.fromEntries(
          Object.entries(profileFields).map(([k, v]) => [k, v.optional()])
        ) as {
          [K in keyof typeof profileFields]: z.ZodOptional<(typeof profileFields)[K]>
        }
      ),
      needsApproval: true,
      execute: async (input) => {
        // Free-text fields clear to null on empty string, so "cleared" reads as
        // unset (null) rather than "set but empty" — matches the medical-condition
        // tools and the SQL/PostgREST convention the app checks against.
        const FREE_TEXT_FIELDS = ['display_name', 'known_allergies', 'family_history', 'extra_notes'] as const
        const patch: TableUpdate<'profiles'> = omitUndefined(input)
        for (const k of FREE_TEXT_FIELDS) {
          const v = patch[k]
          if (typeof v === 'string') patch[k] = emptyToNull(v)
        }
        if (Object.keys(patch).length === 0) return { error: 'No fields to update.' }
        patch.updated_at = new Date().toISOString()
        const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
        if (error) return { error: error.message }
        return { updated: Object.keys(patch).filter((k) => k !== 'updated_at') }
      },
    }),

    // -- Medical conditions --------------------------------------------------

    add_medical_condition: tool({
      description:
        "Add a condition to the user's medical history (e.g. 'Obstructive sleep apnea', 'Hypothyroidism'). start_date/end_date are optional (YYYY-MM-DD); omit end_date for an ongoing condition.",
      inputSchema: z.object({
        condition_name: z.string().min(1).max(200),
        start_date: z.string().date().optional(),
        end_date: z.string().date().optional().describe('Omit for ongoing.'),
        notes: z.string().max(5000).optional(),
      }),
      execute: async ({ condition_name, start_date, end_date, notes }) => {
        const { data, error } = await supabase
          .from('medical_conditions')
          .insert({
            user_id: userId,
            condition_name: condition_name.trim(),
            start_date: emptyToNull(start_date),
            end_date: emptyToNull(end_date),
            notes: emptyToNull(notes),
          })
          .select('id, condition_name, start_date, end_date, notes')
          .single()
        if (error) return { error: error.message }
        return { added: data }
      },
    }),

    update_medical_condition: tool({
      description:
        'Update a medical condition by id (from get_profile). Pass only the fields to change. To mark an ongoing condition as ended, set end_date; to reopen it, pass end_date as an empty string.',
      inputSchema: z.object({
        id: z.string(),
        condition_name: z.string().min(1).max(200).optional(),
        start_date: z.union([z.string().date(), z.literal('')]).optional(),
        end_date: z.union([z.string().date(), z.literal('')]).optional(),
        notes: z.string().max(5000).optional(),
      }),
      needsApproval: true,
      execute: async ({ id, condition_name, start_date, end_date, notes }) => {
        const patch: TableUpdate<'medical_conditions'> = {}
        if (condition_name !== undefined) patch.condition_name = condition_name.trim()
        if (start_date !== undefined) patch.start_date = emptyToNull(start_date)
        if (end_date !== undefined) patch.end_date = emptyToNull(end_date)
        if (notes !== undefined) patch.notes = emptyToNull(notes)
        if (Object.keys(patch).length === 0) return { error: 'No fields to update.' }
        const { data, error } = await supabase
          .from('medical_conditions')
          .update(patch)
          .eq('id', id)
          .eq('user_id', userId)
          .select('id, condition_name, start_date, end_date, notes')
          .maybeSingle()
        if (error) return { error: error.message }
        if (!data) return { error: 'Condition not found.' }
        return { updated: data }
      },
    }),

    remove_medical_condition: tool({
      description:
        'Delete a medical condition by id (from get_profile). IRREVERSIBLE — only after the user confirmed removing THIS condition (restate its name first).',
      inputSchema: z.object({ id: z.string() }),
      needsApproval: true,
      execute: async ({ id }) => {
        const { data: existing } = await supabase
          .from('medical_conditions')
          .select('id, condition_name')
          .eq('id', id)
          .eq('user_id', userId)
          .maybeSingle()
        if (!existing) return { error: 'Condition not found.' }
        const { error } = await supabase
          .from('medical_conditions')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)
        return error ? { error: error.message } : { deleted: existing }
      },
    }),
  }
}
