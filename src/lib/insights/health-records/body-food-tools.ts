import { tool } from 'ai'
import { z } from 'zod'
import type { TableUpdate, TypedSupabaseClient } from '@/lib/supabase/database'

import { omitUndefined } from '@/lib/object/omit-undefined'
import { appTodayISO } from '@/lib/dates/today'

const today = () => appTodayISO()

/**
 * Weight/body log and nutrition (food log + daily targets) tools for the
 * insights chat. Part of `createHealthRecordTools` — same client and user
 * scoping rules apply.
 */
export function createBodyFoodTools(supabase: TypedSupabaseClient, userId: string) {
  return {
    // -- Weight / body log -----------------------------------------------------

    list_body_log: tool({
      description:
        "Read the user's manual body log (weight, body-fat %, waist per date), newest first. Freely callable.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(365).optional().describe('Defaults to 60 entries.'),
      }),
      execute: async ({ limit }) => {
        const { data, error } = await supabase
          .from('body_log_entries')
          .select('id, logged_on, weight_kg, body_fat_pct, waist_cm, notes')
          .eq('user_id', userId)
          .order('logged_on', { ascending: false })
          .limit(limit ?? 60)
        return error ? { error: error.message } : { entries: data ?? [] }
      },
    }),

    log_body_entry: tool({
      description:
        'Log weight / body-fat % / waist for a date (defaults to today). If an entry already exists for that date, the provided fields UPDATE it (no duplicates) — so this also corrects earlier entries. At least one metric is required.',
      inputSchema: z.object({
        logged_on: z.string().date().optional().describe('YYYY-MM-DD, defaults to today.'),
        weight_kg: z.number().positive().optional(),
        body_fat_pct: z.number().min(0).max(100).optional(),
        waist_cm: z.number().positive().optional(),
        notes: z.string().optional(),
      }),
      // A new day's entry runs straight away; overwriting that day's stored
      // entry waits for the user's OK.
      needsApproval: async ({ logged_on }) => {
        const { data, error } = await supabase
          .from('body_log_entries')
          .select('id')
          .eq('user_id', userId)
          .eq('logged_on', logged_on ?? today())
          .limit(1)
        return error !== null || (data ?? []).length > 0
      },
      execute: async ({ logged_on, ...fields }) => {
        if (fields.weight_kg == null && fields.body_fat_pct == null && fields.waist_cm == null) {
          return { error: 'Provide at least one of weight_kg, body_fat_pct or waist_cm.' }
        }
        const date = logged_on ?? today()
        const clean = omitUndefined(fields)
        // No unique constraint on (user, date) — take the newest if several.
        const { data: existingRows } = await supabase
          .from('body_log_entries')
          .select('id')
          .eq('user_id', userId)
          .eq('logged_on', date)
          .order('created_at', { ascending: false })
          .limit(1)
        const existing = existingRows?.[0] ?? null
        if (existing) {
          const { error } = await supabase
            .from('body_log_entries')
            .update(clean)
            .eq('id', existing.id)
            .eq('user_id', userId)
          return error ? { error: error.message } : { updated: existing.id, logged_on: date, ...clean }
        }
        const { data, error } = await supabase
          .from('body_log_entries')
          .insert({ user_id: userId, logged_on: date, ...clean })
          .select('id')
          .single()
        return error || !data
          ? { error: error?.message ?? 'Failed to log entry.' }
          : { added: data.id, logged_on: date, ...clean }
      },
    }),

    delete_body_log_entry: tool({
      description: 'Delete one body-log entry by id (from list_body_log). Use only on explicit user request.',
      inputSchema: z.object({ id: z.string() }),
      needsApproval: true,
      execute: async ({ id }) => {
        const { error } = await supabase
          .from('body_log_entries')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)
        return error ? { error: error.message } : { deleted: id }
      },
    }),

    // -- Nutrition -------------------------------------------------------------

    list_food_logs: tool({
      description:
        "Read the user's food log entries over the last N days (newest first): name, macros, meal type, grams. Freely callable — get ids here before editing/deleting entries.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(90).optional().describe('Window in days, defaults to 7.'),
      }),
      execute: async ({ days }) => {
        const since = new Date(Date.now() - (days ?? 7) * 24 * 60 * 60 * 1000).toISOString()
        const { data, error } = await supabase
          .from('food_logs')
          .select('id, entry_date, food_name, meal_type, grams, calories, protein_g, carbs_g, fat_g, fiber_g, notes')
          .eq('user_id', userId)
          .eq('is_deleted', false)
          .gte('entry_date', since)
          .order('entry_date', { ascending: false })
          .limit(200)
        return error ? { error: error.message } : { entries: data ?? [] }
      },
    }),

    log_food_entry: tool({
      description:
        'Log a food entry with explicit macros (manual entry — no food-database matching). Use when the user states what they ate WITH macros, or you estimated macros together. Defaults to today.',
      inputSchema: z.object({
        food_name: z.string().min(1),
        entry_date: z.string().date().optional().describe('YYYY-MM-DD, defaults to today.'),
        meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
        grams: z.number().positive().optional(),
        calories: z.number().nonnegative().optional(),
        protein_g: z.number().nonnegative().optional(),
        carbs_g: z.number().nonnegative().optional(),
        fat_g: z.number().nonnegative().optional(),
        fiber_g: z.number().nonnegative().optional(),
        sugar_g: z.number().nonnegative().optional(),
        sodium_mg: z.number().nonnegative().optional(),
        saturated_fat_g: z.number().nonnegative().optional(),
        notes: z.string().optional(),
      }),
      execute: async ({ food_name, entry_date, ...fields }) => {
        const date = entry_date ?? today()
        const { data, error } = await supabase
          .from('food_logs')
          .insert({
            user_id: userId,
            // Pin to local noon — a bare date would parse as UTC midnight and
            // land on the previous calendar day west of UTC (same convention
            // as the nutrition page's manual entry).
            entry_date: new Date(`${date}T12:00:00`).toISOString(),
            food_name,
            source: 'app',
            is_deleted: false,
            ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)),
          })
          .select('id')
          .single()
        return error || !data
          ? { error: error?.message ?? 'Failed to log entry.' }
          : { added: data.id, food_name, entry_date: date }
      },
    }),

    update_food_log: tool({
      description:
        'Update a food log entry by id (from list_food_logs): rename, fix macros, change meal type or move to another date. Only the provided fields change (macros are NOT auto-rescaled when grams change — pass corrected macros too).',
      inputSchema: z.object({
        id: z.string(),
        food_name: z.string().min(1).optional(),
        entry_date: z.string().date().optional(),
        meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).nullable().optional(),
        grams: z.number().positive().optional(),
        calories: z.number().nonnegative().nullable().optional(),
        protein_g: z.number().nonnegative().nullable().optional(),
        carbs_g: z.number().nonnegative().nullable().optional(),
        fat_g: z.number().nonnegative().nullable().optional(),
        fiber_g: z.number().nonnegative().nullable().optional(),
        sugar_g: z.number().nonnegative().nullable().optional(),
        sodium_mg: z.number().nonnegative().nullable().optional(),
        saturated_fat_g: z.number().nonnegative().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
      needsApproval: true,
      execute: async ({ id, entry_date, ...patch }) => {
        const clean: TableUpdate<'food_logs'> = omitUndefined(patch)
        if (entry_date) clean.entry_date = new Date(`${entry_date}T12:00:00`).toISOString()
        if (Object.keys(clean).length === 0) return { error: 'No fields to update.' }
        const { data, error } = await supabase
          .from('food_logs')
          .update(clean)
          .eq('id', id)
          .eq('user_id', userId)
          .select('id')
        if (error) return { error: error.message }
        if (!data || data.length === 0) return { error: 'Food log not found.' }
        return { updated: id }
      },
    }),

    delete_food_log: tool({
      description: 'Delete a food log entry by id (soft delete — it disappears from the log). Use only on explicit user request.',
      inputSchema: z.object({ id: z.string() }),
      needsApproval: true,
      execute: async ({ id }) => {
        const { error } = await supabase
          .from('food_logs')
          .update({ is_deleted: true })
          .eq('id', id)
          .eq('user_id', userId)
        return error ? { error: error.message } : { deleted: id }
      },
    }),

    get_nutrition_targets: tool({
      description: "Read the user's daily nutrition targets (calories, protein, carbs, fat). Freely callable.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('nutrition_calorie_target, nutrition_protein_target_g, nutrition_carbs_target_g, nutrition_fat_target_g')
          .eq('id', userId)
          .maybeSingle()
        if (error) return { error: error.message }
        return {
          targets: {
            calories: data?.nutrition_calorie_target ?? null,
            protein_g: data?.nutrition_protein_target_g ?? null,
            carbs_g: data?.nutrition_carbs_target_g ?? null,
            fat_g: data?.nutrition_fat_target_g ?? null,
          },
        }
      },
    }),

    set_nutrition_targets: tool({
      description:
        "Set the user's daily nutrition targets. Only the provided fields change; pass null to clear one. Use only on explicit user request.",
      inputSchema: z.object({
        calories: z.number().int().nonnegative().nullable().optional(),
        protein_g: z.number().int().nonnegative().nullable().optional(),
        carbs_g: z.number().int().nonnegative().nullable().optional(),
        fat_g: z.number().int().nonnegative().nullable().optional(),
      }),
      needsApproval: true,
      execute: async ({ calories, protein_g, carbs_g, fat_g }) => {
        const patch: TableUpdate<'profiles'> = {}
        if (calories !== undefined) patch.nutrition_calorie_target = calories
        if (protein_g !== undefined) patch.nutrition_protein_target_g = protein_g
        if (carbs_g !== undefined) patch.nutrition_carbs_target_g = carbs_g
        if (fat_g !== undefined) patch.nutrition_fat_target_g = fat_g
        if (Object.keys(patch).length === 0) return { error: 'No targets to update.' }
        const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
        return error ? { error: error.message } : { updated: Object.keys(patch) }
      },
    }),
  }
}
