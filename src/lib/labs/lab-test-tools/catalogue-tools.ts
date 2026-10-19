import { tool } from 'ai'
import { z } from 'zod'
import type { TypedSupabaseClient } from '@/lib/supabase/database'

import { normalizeFormat } from '@/lib/export/list-format'

import { enrichListItems, mapCatalogueRows, matchOneLab, resolveLabsByName } from './catalogue'
import type { BuildListsResult, ExportList, FinderTest, LabRow, LabTestMeta } from './types'

const MAX_FINDER_RESULTS = 200
const FETCH_CAP = 1000 // upper bound on rows pulled per lab before JS filtering

/** list_lab_tests, lab_test_finder and build_lab_test_lists (approved, public data only). */
export function createCatalogueTools(supabase: TypedSupabaseClient) {
  async function approvedLabs(): Promise<LabRow[]> {
    const { data } = await supabase
      .from('labs')
      .select('id, name')
      .eq('status', 'approved')
    return (data ?? []) as LabRow[]
  }

  /** Full approved-test catalogue for one lab (with covered biomarkers). */
  async function fetchCatalogue(labId: string): Promise<FinderTest[]> {
    const { data } = await supabase
      .from('lab_tests')
      .select(
        'name, method, cost, currency, turnaround_days, sample_type, provider, lab_test_biomarkers(biomarkers(name, short_name))'
      )
      .eq('lab_id', labId)
      .eq('status', 'approved')
      .order('name')
      .limit(FETCH_CAP)
    return mapCatalogueRows((data ?? []) as unknown[])
  }

  return {
    list_lab_tests: tool({
      description:
        'List the FULL test catalogue offered by one or more approved labs in a single call — every test with its metadata (method, cost, sample, turnaround), the analyzing-lab provider when outsourced (e.g. a partner reference lab like Biovis Diagnostik MVZ GmbH), and the biomarkers each test covers. Use this for broad or comprehensive requests (e.g. "a general health check", "everything relevant at Bodimed and Lina") so you see the whole catalogue at once and pick from it, instead of many narrow lab_test_finder calls. For a targeted "does lab X offer biomarker Y?" check, use lab_test_finder instead.',
      inputSchema: z.object({
        labs: z
          .array(z.string())
          .min(1)
          .describe('Lab names to list in full, e.g. ["Bodimed", "Lina"].'),
      }),
      execute: async ({ labs }) => {
        const { matched, unmatched } = resolveLabsByName(labs, await approvedLabs())
        const out = []
        for (const lab of matched) {
          const tests = await fetchCatalogue(lab.id)
          out.push({
            labId: lab.id,
            labName: lab.name,
            testCount: tests.length,
            tests,
          })
        }
        return { labs: out, unmatchedLabs: unmatched }
      },
    }),

    lab_test_finder: tool({
      description:
        'Look up which approved labs offer which tests, with metadata (method, cost, sample, turnaround) and the biomarkers each test covers. Filter by lab name(s) and optionally by a name query and/or catalogue biomarker names. Use this to discover what is actually available before recommending or listing tests.',
      inputSchema: z.object({
        labs: z
          .array(z.string())
          .min(1)
          .describe('Lab names to search, e.g. ["Bodimed", "Lina"].'),
        query: z
          .string()
          .optional()
          .describe('Optional case-insensitive substring to match in the test name.'),
        biomarkers: z
          .array(z.string())
          .optional()
          .describe(
            'Optional catalogue biomarker names/short-names; only tests covering one of these are returned.'
          ),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Max tests per lab (default 50, max 200).'),
      }),
      execute: async ({ labs, query, biomarkers, limit }) => {
        const max = Math.min(limit ?? 50, MAX_FINDER_RESULTS)
        const { matched, unmatched } = resolveLabsByName(labs, await approvedLabs())
        const q = query?.toLowerCase().trim() || null
        const wantedBm = biomarkers?.length
          ? new Set(biomarkers.map((b) => b.toLowerCase().trim()))
          : null

        const out = []
        for (const lab of matched) {
          let tests = await fetchCatalogue(lab.id)
          if (q) tests = tests.filter((t) => t.name.toLowerCase().includes(q))
          if (wantedBm) {
            tests = tests.filter((t) =>
              t.biomarkers.some(
                (b) =>
                  wantedBm.has(b.name.toLowerCase()) ||
                  (b.short_name != null && wantedBm.has(b.short_name.toLowerCase()))
              )
            )
          }
          out.push({ labId: lab.id, labName: lab.name, tests: tests.slice(0, max) })
        }
        return { labs: out, unmatchedLabs: unmatched }
      },
    }),

    build_lab_test_lists: tool({
      description:
        'Finalize one or more per-lab test lists for the user to download and hand to each lab. Only include tests you have confirmed (via lab_test_finder) are offered by that lab. The chat renders each list as a downloadable card (PDF + TXT).',
      inputSchema: z.object({
        title: z
          .string()
          .optional()
          .describe('Optional overall title, e.g. "Tests to request — May 2026".'),
        lists: z
          .array(
            z.object({
              labName: z.string(),
              items: z
                .array(
                  z.object({
                    testName: z.string(),
                    reason: z
                      .string()
                      .optional()
                      .describe('Optional one-line rationale grounded in the user data.'),
                  })
                )
                .min(1),
            })
          )
          .min(1),
        format: z
          .object({
            columns: z
              .array(z.enum(['method', 'cost', 'sample', 'turnaround', 'reason']))
              .optional()
              .describe('Optional columns besides the test name. Omit for all.'),
            sort: z
              .enum(['default', 'name', 'cost_asc', 'cost_desc'])
              .optional()
              .describe('Row order: keep your order (default), by name, or by cost.'),
            hideUnavailable: z
              .boolean()
              .optional()
              .describe('Drop tests the lab does not offer (and their "not available" text).'),
          })
          .optional()
          .describe(
            'Output formatting when the user asks for it — e.g. only name+cost, sort by cost, hide unavailable. The user can also tweak this on the download card afterwards.'
          ),
      }),
      execute: async ({ title, lists, format }) => {
        const labs = await approvedLabs()
        const outLists: ExportList[] = []
        for (const list of lists) {
          const lab = matchOneLab(list.labName, labs)
          if (!lab) {
            outLists.push({
              labName: list.labName,
              labFound: false,
              items: enrichListItems(list.items, []),
            })
            continue
          }
          const { data } = await supabase
            .from('lab_tests')
            .select('name, method, cost, currency, turnaround_days, sample_type')
            .eq('lab_id', lab.id)
            .eq('status', 'approved')
            .limit(FETCH_CAP)
          outLists.push({
            labName: lab.name,
            labFound: true,
            items: enrichListItems(list.items, (data ?? []) as LabTestMeta[]),
          })
        }
        return {
          title: title ?? null,
          lists: outLists,
          format: normalizeFormat(format),
        } satisfies BuildListsResult
      },
    }),
  }
}
