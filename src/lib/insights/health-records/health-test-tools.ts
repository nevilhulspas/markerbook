import { tool } from 'ai'
import { z } from 'zod'
import type { TableUpdate, TypedSupabaseClient } from '@/lib/supabase/database'

// ---------------------------------------------------------------------------
// update_health_test numeric-field whitelists
// ---------------------------------------------------------------------------

const DEXA_NUMERIC_FIELDS = [
  'age_years', 'height_cm', 'weight_kg', 'total_mass_kg', 'fat_mass_g',
  'lean_mass_g', 'bmc_g', 'body_fat_pct', 'visceral_fat_g', 'android_fat_pct',
  'gynoid_fat_pct', 'android_gynoid_ratio', 'almi', 'ffmi', 'bone_t_score',
  'bone_z_score', 'total_bmd',
] as const

const RMR_NUMERIC_FIELDS = [
  'rmr_kcal', 'predicted_rmr_kcal', 'rer', 'fuel_carb_pct', 'fuel_fat_pct',
] as const

export const NUMERIC_FIELD_WHITELIST: Record<string, readonly string[]> = {
  dexa: DEXA_NUMERIC_FIELDS,
  rmr: RMR_NUMERIC_FIELDS,
  microbiome: [],
  dutch: ['cycle_day'],
}

export const HEALTH_TEST_TABLES = {
  dexa: { table: 'dexa_scans', dateColumn: 'scan_date' },
  microbiome: { table: 'microbiome_tests', dateColumn: 'test_date' },
  dutch: { table: 'dutch_tests', dateColumn: 'test_date' },
  rmr: { table: 'rmr_tests', dateColumn: 'test_date' },
} as const

// Rows per list_health_tests page. The tool reports the total so the model
// can page with `offset` instead of taking the first page for everything.
const LIST_PAGE_SIZE = 50

type HealthTestType = keyof typeof HEALTH_TEST_TABLES
type HealthTestTable = (typeof HEALTH_TEST_TABLES)[HealthTestType]['table']

/**
 * DEXA / microbiome / DUTCH / RMR test tools for the insights chat (list, read,
 * update, delete). Part of `createHealthRecordTools` — same client and user
 * scoping rules apply.
 */
export function createHealthTestTools(supabase: TypedSupabaseClient, userId: string) {
  return {
    list_health_tests: tool({
      description:
        "List the user's DEXA scans, microbiome tests, DUTCH tests or RMR tests (id + date + key fields), newest first, one page at a time. `total` is the full count; while `truncated` is true, call again with `offset: next_offset` until it is false. Freely callable — get ids here before get/update/delete.",
      inputSchema: z.object({
        type: z.enum(['dexa', 'microbiome', 'dutch', 'rmr']),
        offset: z.number().int().min(0).optional().describe('Skip this many newest tests (paging).'),
      }),
      execute: async ({ type, offset = 0 }) => {
        const { table, dateColumn } = HEALTH_TEST_TABLES[type]
        const columns: Record<HealthTestType, string> = {
          dexa: 'id, scan_date, provider, body_fat_pct, total_mass_kg, lean_mass_g, source',
          microbiome: 'id, name, test_date, lab_name, sample_type',
          dutch: 'id, name, test_date, menstrual_phase, cycle_day',
          rmr: 'id, test_date, provider, rmr_kcal, rer, source',
        }
        const { data, error, count } = await supabase
          .from(table)
          .select(columns[type], { count: 'exact' })
          .eq('user_id', userId)
          .order(dateColumn, { ascending: false })
          .range(offset, offset + LIST_PAGE_SIZE - 1)
        if (error) return { error: error.message }
        const tests = data ?? []
        const total = count ?? offset + tests.length
        const nextOffset = offset + tests.length
        return nextOffset < total
          ? { tests, total, truncated: true, next_offset: nextOffset }
          : { tests, total, truncated: false }
      },
    }),

    get_health_test: tool({
      description:
        'Read one DEXA scan (with body regions), microbiome test (with scores + taxa results), DUTCH test (with hormone results + computed ratios) or RMR test in full. Freely callable.',
      inputSchema: z.object({
        type: z.enum(['dexa', 'microbiome', 'dutch', 'rmr']),
        id: z.string(),
      }),
      execute: async ({ type, id }) => {
        const { table } = HEALTH_TEST_TABLES[type]
        const { data: row, error } = await supabase
          .from(table)
          .select('*')
          .eq('id', id)
          .eq('user_id', userId)
          .maybeSingle()
        if (error) return { error: error.message }
        if (!row) return { error: 'Test not found.' }

        if (type === 'dexa') {
          const { data: regions } = await supabase.from('dexa_regions').select('*').eq('scan_id', id)
          return { scan: row, regions: regions ?? [] }
        }
        if (type === 'microbiome') {
          const [{ data: scores }, { data: results, count }] = await Promise.all([
            supabase.from('microbiome_scores').select('name, value, unit, ref_low, ref_high, status').eq('microbiome_test_id', id),
            supabase
              .from('microbiome_results')
              .select('value, unit, ref_low, ref_high, status, raw_label, microbiome_taxa(name, rank)', { count: 'exact' })
              .eq('microbiome_test_id', id)
              .limit(150),
          ])
          return {
            test: row,
            scores: scores ?? [],
            results: (results ?? []).map((r) => {
              const taxa = r.microbiome_taxa
              return { taxon: taxa?.name ?? r.raw_label ?? 'unknown', rank: taxa?.rank ?? null, value: r.value, unit: r.unit, status: r.status }
            }),
            total_results: count ?? (results?.length ?? 0),
          }
        }
        if (type === 'dutch') {
          // AUT-904 moved DUTCH markers into their own table: dutch_test_results
          // FKs to dutch_markers (NOT the shared biomarkers catalog), so embed that.
          const [{ data: results }, { data: computed }] = await Promise.all([
            supabase
              .from('dutch_test_results')
              .select('value, unit, timepoint, dutch_markers(name)')
              .eq('dutch_test_id', id),
            supabase.from('dutch_computed_values').select('name, value, unit, formula').eq('dutch_test_id', id),
          ])
          return {
            test: row,
            results: (results ?? []).map((r) => ({
              marker: r.dutch_markers?.name ?? 'unknown',
              value: r.value,
              unit: r.unit,
              timepoint: r.timepoint,
            })),
            computed: computed ?? [],
          }
        }
        return { test: row }
      },
    }),

    update_health_test: tool({
      description:
        'Update a DEXA / microbiome / DUTCH / RMR test: metadata (name, date, notes, provider/lab name, sample type, menstrual phase) and/or numeric values via `values` (DEXA: body_fat_pct, lean_mass_g, total_mass_kg, visceral_fat_g, etc.; RMR: rmr_kcal, rer, fuel pcts; DUTCH: cycle_day). Only provided fields change. To fix individual microbiome taxa or DUTCH hormone results, re-upload the report instead.',
      inputSchema: z.object({
        type: z.enum(['dexa', 'microbiome', 'dutch', 'rmr']),
        id: z.string(),
        name: z.string().max(200).optional().describe('Not for DEXA (scans have no name).'),
        date: z.string().date().optional(),
        notes: z.string().max(1000).nullable().optional(),
        provider: z.string().optional().describe('DEXA/RMR provider.'),
        lab_name: z.string().optional().describe('Microbiome lab name.'),
        sample_type: z.string().optional().describe('Microbiome sample type.'),
        menstrual_phase: z
          .enum(['follicular', 'luteal', 'postmenopausal', 'oral_progesterone', 'oral_contraceptive', 'male', 'unknown'])
          .optional()
          .describe('DUTCH only.'),
        values: z.record(z.string(), z.number().nullable()).optional().describe('Numeric fields to set (whitelisted per type).'),
      }),
      needsApproval: true,
      execute: async ({ type, id, date, values, ...rest }) => {
        const { table, dateColumn } = HEALTH_TEST_TABLES[type]
        const allowedMeta: Record<HealthTestType, string[]> = {
          dexa: ['notes', 'provider'],
          microbiome: ['name', 'notes', 'lab_name', 'sample_type'],
          dutch: ['name', 'notes', 'menstrual_phase'],
          rmr: ['notes', 'provider'],
        }
        const patch: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(rest)) {
          if (v === undefined) continue
          if (!allowedMeta[type].includes(k)) {
            return { error: `Field "${k}" does not apply to ${type} tests. Allowed: ${allowedMeta[type].join(', ')}.` }
          }
          patch[k] = v
        }
        if (date) patch[dateColumn] = date
        if (values) {
          const whitelist = NUMERIC_FIELD_WHITELIST[type]
          for (const [k, v] of Object.entries(values)) {
            if (!whitelist.includes(k)) {
              return { error: `Numeric field "${k}" is not editable on ${type} tests. Allowed: ${whitelist.join(', ') || 'none'}.` }
            }
            patch[k] = v
          }
        }
        if (Object.keys(patch).length === 0) return { error: 'No fields to update.' }
        patch.updated_at = new Date().toISOString()
        // Keys are checked against the per-type field lists above.
        const { data, error } = await supabase
          .from(table)
          .update(patch as TableUpdate<HealthTestTable>)
          .eq('id', id)
          .eq('user_id', userId)
          .select('id')
        if (error) return { error: error.message }
        if (!data || data.length === 0) return { error: 'Test not found.' }
        return { updated: id, changed: Object.keys(patch).filter((k) => k !== 'updated_at') }
      },
    }),

    delete_health_test: tool({
      description:
        'Delete a DEXA scan, microbiome test, DUTCH test or RMR test including all its results/regions. IRREVERSIBLE — only after the user explicitly confirmed deleting THIS test (restate type + date first).',
      inputSchema: z.object({
        type: z.enum(['dexa', 'microbiome', 'dutch', 'rmr']),
        id: z.string(),
      }),
      needsApproval: true,
      execute: async ({ type, id }) => {
        const { table, dateColumn } = HEALTH_TEST_TABLES[type]
        const { data: existing, error: lookupError } = await supabase
          .from(table)
          .select(`id, ${dateColumn}`)
          .eq('id', id)
          .eq('user_id', userId)
          .maybeSingle()
        if (lookupError) return { error: lookupError.message }
        if (!existing) return { error: 'Test not found.' }
        const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', userId)
        return error ? { error: error.message } : { deleted: existing }
      },
    }),
  }
}
