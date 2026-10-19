import { tool } from 'ai'
import { z } from 'zod'
import type { TypedSupabaseClient } from '@/lib/supabase/database'
import { omitUndefined } from '@/lib/object/omit-undefined'
import type { TableUpdate } from '@/lib/supabase/database'

// Chat tools for the "Other tests" screen — miscellaneous results that don't
// fit blood / DEXA / microbiome / DUTCH / RMR (SIBO breath test, STI screen,
// sleep study, intolerance panels, …). Backed by `other_tests` (+ its
// `other_test_values` readings), scoped to the caller's user_id.

const OUTCOMES = [
  'positive', 'negative', 'normal', 'abnormal', 'inconclusive', 'not_applicable',
] as const

const readingSchema = z.object({
  label: z.string().min(1).describe('e.g. "Hydrogen peak", "Anti-HSV2 IgG".'),
  value: z.string().nullable().optional().describe('String so it can hold "12", "Detected", "Elevated"…'),
  unit: z.string().nullable().optional(),
  flag: z.string().nullable().optional().describe('e.g. "H", "L", "positive".'),
})

export function createOtherTestTools(supabase: TypedSupabaseClient, userId: string) {
  return {
    list_other_tests: tool({
      description:
        "List the user's \"Other tests\" — miscellaneous results (SIBO breath test, STI/infection screen, sleep study, intolerance panels, anything that isn't blood/DEXA/microbiome/DUTCH/RMR). Returns id, name, date, provider, outcome, newest first. Freely callable — get ids here before get/update/delete.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data, error } = await supabase
          .from('other_tests')
          .select('id, test_name, test_date, provider, outcome, result_summary')
          .eq('user_id', userId)
          .order('test_date', { ascending: false })
          .limit(100)
        return error ? { error: error.message } : { tests: data ?? [] }
      },
    }),

    get_other_test: tool({
      description:
        'Read one "Other test" in full: its metadata plus all individual readings (label, value, unit, flag). Freely callable.',
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        const { data: test, error } = await supabase
          .from('other_tests')
          .select('id, test_name, test_date, provider, outcome, result_summary, notes, source')
          .eq('id', id)
          .eq('user_id', userId)
          .maybeSingle()
        if (error) return { error: error.message }
        if (!test) return { error: 'Test not found.' }
        const { data: values } = await supabase
          .from('other_test_values')
          .select('label, value, unit, flag, sort_order')
          .eq('test_id', id)
          .order('sort_order', { ascending: true })
        return { test, values: values ?? [] }
      },
    }),

    create_other_test: tool({
      description:
        'Create a NEW "Other test" from scratch (use when the user dictates a result rather than uploading a document). Provide the name, date, and optionally an outcome, a short result_summary, provider, notes, and individual readings.',
      inputSchema: z.object({
        test_name: z.string().min(1).max(200).describe('e.g. "SIBO breath test (lactulose)".'),
        test_date: z.string().date().describe('YYYY-MM-DD.'),
        outcome: z.enum(OUTCOMES).optional().describe('Overall verdict. Defaults to not_applicable.'),
        provider: z.string().max(200).optional(),
        result_summary: z.string().max(2000).optional().describe('One-line summary shown on the card.'),
        notes: z.string().max(5000).optional(),
        readings: z.array(readingSchema).optional(),
      }),
      execute: async ({ test_name, test_date, outcome, provider, result_summary, notes, readings }) => {
        const { data: test, error } = await supabase
          .from('other_tests')
          .insert({
            user_id: userId,
            test_name,
            test_date,
            outcome: outcome ?? 'not_applicable',
            provider: provider ?? null,
            result_summary: result_summary ?? null,
            notes: notes ?? null,
            source: 'manual',
          })
          .select('id')
          .single()
        if (error || !test) return { error: error?.message ?? 'Failed to create test.' }
        if (readings && readings.length > 0) {
          const { error: vErr } = await supabase.from('other_test_values').insert(
            readings.map((r, i) => ({
              test_id: test.id,
              label: r.label,
              value: r.value ?? null,
              unit: r.unit ?? null,
              flag: r.flag ?? null,
              sort_order: i,
            }))
          )
          if (vErr) return { error: `Test created but readings failed: ${vErr.message}`, id: test.id }
        }
        return { created: test.id }
      },
    }),

    update_other_test: tool({
      description:
        'Update an "Other test" by id (from list_other_tests). Only the metadata fields you pass change. If you pass `readings`, the test\'s entire reading list is REPLACED with it — omit `readings` to leave the existing readings untouched.',
      inputSchema: z.object({
        id: z.string(),
        test_name: z.string().min(1).max(200).optional(),
        test_date: z.string().date().optional(),
        outcome: z.enum(OUTCOMES).optional(),
        provider: z.string().max(200).nullable().optional(),
        result_summary: z.string().max(2000).nullable().optional(),
        notes: z.string().max(5000).nullable().optional(),
        readings: z.array(readingSchema).optional().describe('Pass to REPLACE all readings; omit to keep them.'),
      }),
      execute: async ({ id, readings, ...meta }) => {
        const { data: existing } = await supabase
          .from('other_tests')
          .select('id')
          .eq('id', id)
          .eq('user_id', userId)
          .maybeSingle()
        if (!existing) return { error: 'Test not found.' }

        const patch: TableUpdate<'other_tests'> = omitUndefined(meta)
        if (Object.keys(patch).length > 0) {
          patch.updated_at = new Date().toISOString()
          const { error } = await supabase
            .from('other_tests')
            .update(patch)
            .eq('id', id)
            .eq('user_id', userId)
          if (error) return { error: error.message }
        }

        if (readings !== undefined) {
          // Snapshot so a failed re-insert can roll back (mirrors updateOtherTest).
          const { data: prev, error: snapErr } = await supabase
            .from('other_test_values')
            .select('label, value, unit, flag, sort_order')
            .eq('test_id', id)
          if (snapErr) return { error: snapErr.message }
          const { error: delErr } = await supabase.from('other_test_values').delete().eq('test_id', id)
          if (delErr) return { error: delErr.message }
          if (readings.length > 0) {
            const { error: insErr } = await supabase.from('other_test_values').insert(
              readings.map((r, i) => ({
                test_id: id,
                label: r.label,
                value: r.value ?? null,
                unit: r.unit ?? null,
                flag: r.flag ?? null,
                sort_order: i,
              }))
            )
            if (insErr) {
              if (prev && prev.length > 0) {
                const { error: restoreErr } = await supabase
                  .from('other_test_values')
                  .insert(prev.map((p) => ({ ...p, test_id: id })))
                if (restoreErr) {
                  return {
                    error: `Readings update failed (${insErr.message}) and the previous readings could NOT be restored (${restoreErr.message}). Tell the user their readings for this test are now missing.`,
                  }
                }
              }
              return { error: `Readings update failed and were restored: ${insErr.message}` }
            }
          }
        }

        return {
          updated: id,
          changed: [
            ...Object.keys(patch).filter((k) => k !== 'updated_at'),
            ...(readings !== undefined ? ['readings'] : []),
          ],
        }
      },
    }),

    delete_other_test: tool({
      description:
        'Delete an "Other test" and all its readings by id. IRREVERSIBLE — only after the user confirmed deleting THIS test (restate its name + date first).',
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        const { data: existing } = await supabase
          .from('other_tests')
          .select('id, test_name, test_date')
          .eq('id', id)
          .eq('user_id', userId)
          .maybeSingle()
        if (!existing) return { error: 'Test not found.' }
        // other_test_values FK-cascades on delete (see migration); remove the row.
        const { error } = await supabase.from('other_tests').delete().eq('id', id).eq('user_id', userId)
        return error ? { error: error.message } : { deleted: existing }
      },
    }),
  }
}
