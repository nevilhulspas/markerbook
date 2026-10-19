import { tool } from 'ai'
import { z } from 'zod'
import type { TypedSupabaseClient } from '@/lib/supabase/database'

import { SAMPLE_TYPES } from '@/lib/labs/name-match'
import { resolveListId as resolveList } from '@/lib/next-to-test/lists'
import {
  addBiomarkerItem,
  addLabTestItem,
  fetchBiomarkerRows,
  fetchLabTestRows,
  type AddItemOutcome,
  type EntryKind,
} from './add-item'

/** The tool error when a catalogue read fails — nothing was saved. */
function catalogueError(message: string): string {
  return `Could not read the test catalogue, nothing was saved: ${message}`
}

/** add_to_next_to_test's result for one resolved item. */
function toSingleResult(outcome: AddItemOutcome, withLab: boolean) {
  switch (outcome.status) {
    case 'added': {
      const { id, kind, name, lab } = outcome
      return {
        added: true as const,
        // Only the lab-pinned path reports a `lab` on the entry.
        entry: withLab ? { id, kind, name, lab } : { id, kind, name },
      }
    }
    case 'duplicate':
      return { error: 'duplicate' as const }
    case 'ambiguous':
      return { error: 'ambiguous' as const, candidates: outcome.candidates }
    case 'error':
      return { error: outcome.message }
  }
}

type ItemResult =
  | { status: 'added'; kind: EntryKind; name: string; lab: string | null; entryId: string }
  | { status: 'duplicate'; kind: EntryKind; name: string; lab: string | null }
  | { status: 'ambiguous'; query: string; candidates: string[] }
  | { status: 'error'; query: string; message: string }

/** add_many_to_next_to_test's per-item result; `query` echoes the request. */
function toItemResult(outcome: AddItemOutcome, query: string): ItemResult {
  switch (outcome.status) {
    case 'added':
      return {
        status: 'added',
        kind: outcome.kind,
        name: outcome.name,
        lab: outcome.lab,
        entryId: outcome.id,
      }
    case 'duplicate':
      return { status: 'duplicate', kind: outcome.kind, name: outcome.name, lab: outcome.lab }
    case 'ambiguous':
      return { status: 'ambiguous', query, candidates: outcome.candidates }
    case 'error':
      return { status: 'error', query, message: outcome.message }
  }
}

/** The single and batch "add to next-to-test" tools. */
export function createAddToNextToTestTools(supabase: TypedSupabaseClient, userId: string) {
  const resolveListId = (name?: string) => resolveList(supabase, userId, name)

  return {
    add_to_next_to_test: tool({
      description:
        "Save a test the user wants to remember to order. PREFER the biomarker form (just biomarkerName) — this saves the test lab-agnostically and lets them choose a lab later. Only use the lab-test form (labName + testName) when the user has EXPLICITLY named a specific lab in their message. Pass `sampleType` ('blood' | 'urine' | 'stool' | 'saliva' | 'hair' | 'serum' | 'plasma') when the catalogue has multiple variants and the user implied a sample — e.g. DHEA-S blood vs DHEA-S (Urine), Cortisol serum vs Cortisol (Saliva). Default assumption when the user doesn't specify is 'blood' for routine markers. If the user just names a test and you're unsure whether to save it lab-agnostically or pin it to a lab, FIRST call ask_user with options like 'Save lab-agnostically (decide later)' and one option per lab that offers this test — never silently pick a lab on the user's behalf. If the test isn't in our catalogue (neither a known biomarker nor an approved lab-test), it is saved AUTOMATICALLY as a free-text custom entry (returned with `kind:'custom'`) — never refuse a test just because it's not in the catalogue. Use ONLY when the user explicitly says 'add this to my list', 'remember to test X', or similar.",
      inputSchema: z.object({
        biomarkerName: z.string().optional(),
        labName: z.string().optional(),
        testName: z.string().optional(),
        sampleType: z.enum(SAMPLE_TYPES).optional(),
        listName: z.string().optional(),
        note: z.string().optional(),
        dueDate: z.string().optional(),
      }),
      execute: async ({
        biomarkerName,
        labName,
        testName,
        sampleType,
        listName,
        note,
        dueDate,
      }) => {
        // A lone testName (no labName) is treated as a lab-agnostic name — the
        // same as biomarkerName — so the model can pass an uncatalogued test
        // either way without tripping a validation error. Only when BOTH
        // testName and labName are present do we take the lab-pinned path.
        const hasLab = !!(labName && testName)
        // `||`, not `??`: an empty biomarkerName must not shadow a lone
        // testName (the batch tool's refine accepts that combination too).
        const agnosticName = biomarkerName || (hasLab ? undefined : testName)
        if (!hasLab && !agnosticName) {
          return { error: 'invalid_arguments' as const }
        }
        // The list is resolved lazily, only when an insert is about to happen.
        const ctx = { supabase, userId, getListId: () => resolveListId(listName), note, dueDate }

        if (!hasLab) {
          const catalogue = await fetchBiomarkerRows(supabase)
          if ('error' in catalogue) return { error: catalogueError(catalogue.error) }
          return toSingleResult(
            await addBiomarkerItem(ctx, catalogue.rows, agnosticName!, sampleType),
            false
          )
        }

        // Lab test path.
        const catalogue = await fetchLabTestRows(supabase)
        if ('error' in catalogue) return { error: catalogueError(catalogue.error) }
        return toSingleResult(
          await addLabTestItem(ctx, catalogue.rows, labName!, testName!, sampleType),
          true
        )
      },
    }),

    add_many_to_next_to_test: tool({
      description:
        "Add MANY tests to a next-to-test list in a single call. STRONGLY PREFER this over looping `add_to_next_to_test` when the user asks to save more than a couple of items (e.g. 'add my full panel', 'save all the cardio markers') — it does one round-trip and reports per-item outcomes, so a single ambiguous entry doesn't unravel the rest. Each item just needs a name: { biomarkerName } (lab-agnostic, preferred) — or { testName } on its own for a specialty/uncatalogued test. `labName` is OPTIONAL; add it (with testName) ONLY to pin to a specific lab. A name not in the catalogue is saved as a free-text custom entry — never require a lab for that. Per-item `sampleType` ('blood' | 'urine' | 'stool' | 'saliva' | 'hair' | 'serum' | 'plasma') narrows variants — pass 'blood' on routine markers by default. Same listName/note/dueDate apply to every item. Tests not in our catalogue are saved automatically as free-text custom entries (no failure). Returns a results array AND a summary counting added/added_custom/duplicate/ambiguous/error (`added` includes `added_custom`; `added_custom` is the subset saved as free-text) — after which you should briefly tell the user what got added (noting how many were saved as custom), what was a duplicate, and which were ambiguous and need resolution; do not loop with single-add to retry.",
      inputSchema: z.object({
        items: z
          .array(
            z
              .object({
                biomarkerName: z.string().optional(),
                testName: z.string().optional(),
                labName: z.string().optional(),
                sampleType: z.enum(SAMPLE_TYPES).optional(),
              })
              .refine(
                // At least a name. labName is OPTIONAL: a lone biomarkerName or
                // testName is saved lab-agnostically (and as a custom entry if
                // it isn't in the catalogue); add labName only to pin to a lab.
                (v) => !!(v.biomarkerName || v.testName),
                {
                  message:
                    'Each item needs a name: biomarkerName (preferred, lab-agnostic) or testName. labName is optional — add it only to pin the test to a specific lab.',
                }
              )
          )
          .min(1)
          .max(100)
          .describe('Items to add. 1–100 per call.'),
        listName: z.string().optional(),
        note: z.string().optional(),
        dueDate: z.string().optional(),
      }),
      execute: async ({ items, listName, note, dueDate }) => {
        // Pre-fetch the catalogues we need, once, so items are score-matched
        // without per-item DB calls. Done before the list is resolved, so a
        // failed read creates no list.
        // A lone testName (no labName) resolves against the biomarker catalogue
        // too (falling back to custom), so it needs the biomarker prefetch.
        const needsBio = items.some((i) => i.biomarkerName || (i.testName && !i.labName))
        const needsLab = items.some((i) => i.testName && i.labName)
        const bioCatalogue = needsBio ? await fetchBiomarkerRows(supabase) : { rows: [] }
        if ('error' in bioCatalogue) return { error: catalogueError(bioCatalogue.error) }
        const labCatalogue = needsLab ? await fetchLabTestRows(supabase) : { rows: [] }
        if ('error' in labCatalogue) return { error: catalogueError(labCatalogue.error) }
        const bms = bioCatalogue.rows
        const lts = labCatalogue.rows

        // Resolve list ONCE for the whole batch.
        const listId = await resolveListId(listName)
        const ctx = { supabase, userId, getListId: async () => listId, note, dueDate }

        const results: ItemResult[] = []

        for (const item of items) {
          // Lab-agnostic path: a biomarkerName, OR a lone testName with no lab.
          const labPath = !!(item.testName && item.labName)
          if (!labPath) {
            const needle = (item.biomarkerName || item.testName)!
            results.push(toItemResult(await addBiomarkerItem(ctx, bms, needle, item.sampleType), needle))
            continue
          }

          // Lab-test path
          const tName = item.testName!
          const lName = item.labName!
          const outcome = await addLabTestItem(ctx, lts, lName, tName, item.sampleType)
          results.push(toItemResult(outcome, `${tName} (${lName})`))
        }

        const summary = {
          added: results.filter((r) => r.status === 'added').length,
          // Subset of `added` saved as free-text custom entries (not in the
          // catalogue) — surface separately so the model can tell the user.
          added_custom: results.filter(
            (r) => r.status === 'added' && r.kind === 'custom'
          ).length,
          duplicate: results.filter((r) => r.status === 'duplicate').length,
          ambiguous: results.filter((r) => r.status === 'ambiguous').length,
          error: results.filter((r) => r.status === 'error').length,
        }
        return { results, summary }
      },
    }),
  }
}
