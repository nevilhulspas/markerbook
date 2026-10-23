import { tool } from 'ai'
import { z } from 'zod'
import type { TypedSupabaseClient } from '@/lib/supabase/database'

import { firstLab } from '@/lib/labs/name-match'

import { createAddToNextToTestTools } from './add-tools'

/** The user's next-to-test lists: read, add (single + batch), mark done, remove. */
export function createNextToTestTools(supabase: TypedSupabaseClient, userId: string) {
  return {
    list_next_to_test_lists: tool({
      description:
        "Read the user's next-to-test LISTS themselves (not their entries) — each list's name and how many pending items it holds. ALWAYS call this BEFORE adding anything, so you can add to an existing list (by passing its name as `listName`) or ask the user which one, instead of inventing a brand-new list. Freely callable.",
      inputSchema: z.object({}),
      execute: async () => {
        const [listsRes, entriesRes] = await Promise.all([
          supabase
            .from('next_to_test_lists')
            .select('id, name, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
          supabase
            .from('next_to_test')
            .select('list_id, status')
            .eq('user_id', userId),
        ])
        // Surface DB errors instead of swallowing them — otherwise a failed
        // query returns null data, the tool reports "no lists", and the model
        // silently creates a brand-new list (the bug this tool prevents).
        if (listsRes.error || entriesRes.error) {
          return { error: (listsRes.error ?? entriesRes.error)!.message }
        }
        const pendingByList = new Map<string, number>()
        for (const e of (entriesRes.data ?? []) as Array<{ list_id: string; status: string }>) {
          if (e.status === 'pending') {
            pendingByList.set(e.list_id, (pendingByList.get(e.list_id) ?? 0) + 1)
          }
        }
        // Return only name + pending — NOT the UUID id. The add tools take a
        // human-readable `listName`; if the model passed an id as listName,
        // resolveListId wouldn't match and would create a UUID-named list.
        const lists = ((listsRes.data ?? []) as Array<{ id: string; name: string }>).map(
          (l) => ({ name: l.name, pending: pendingByList.get(l.id) ?? 0 })
        )
        return { lists }
      },
    }),

    list_next_to_test: tool({
      description:
        "Read the user's next-to-test lists. Returns entries (biomarker or lab_test) the user has saved for later ordering. Default status filter is 'pending'.",
      inputSchema: z.object({
        listName: z.string().optional(),
        status: z.enum(['pending', 'done', 'all']).optional(),
      }),
      execute: async ({ listName, status }) => {
        // Case-insensitive match — without this, a `listName` whose capitalization
        // doesn't match the stored row returns null, and the `.eq('list_id', ...)`
        // filter below silently drops, returning entries across ALL of the user's
        // lists. Every read returns its error: an empty result would tell the
        // model the user has nothing saved, and it would act on that.
        let targetList: { id: string; name: string } | null = null
        if (listName) {
          const { data, error } = await supabase
            .from('next_to_test_lists')
            .select('id, name')
            .eq('user_id', userId)
            .ilike('name', listName)
            .maybeSingle()
          if (error) return { error: error.message }
          targetList = data
        }
        const eff = status ?? 'pending'
        let q = supabase
          .from('next_to_test')
          .select('id, list_id, biomarker_id, lab_test_id, test_type, custom_name, note, due_date, status')
          .eq('user_id', userId)
        if (targetList) q = q.eq('list_id', targetList.id)
        if (eff !== 'all') q = q.eq('status', eff)
        const { data: rows, error: rowsError } = await q
        if (rowsError) return { error: rowsError.message }
        const list = (rows ?? []) as Array<{
          id: string
          list_id: string
          biomarker_id: string | null
          lab_test_id: string | null
          test_type: string | null
          custom_name: string | null
          note: string | null
          due_date: string | null
          status: 'pending' | 'done'
        }>

        const bmIds = list.filter((r) => r.biomarker_id).map((r) => r.biomarker_id as string)
        const ltIds = list.filter((r) => r.lab_test_id).map((r) => r.lab_test_id as string)
        const [bms, lts, allLists] = await Promise.all([
          bmIds.length
            ? supabase.from('biomarkers').select('id, name').in('id', bmIds)
            : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
          ltIds.length
            ? supabase.from('lab_tests').select('id, name, labs(name)').in('id', ltIds)
            : Promise.resolve({
                data: [] as Array<{
                  id: string
                  name: string
                  labs: { name: string } | { name: string }[] | null
                }>,
              }),
          supabase.from('next_to_test_lists').select('id, name').eq('user_id', userId),
        ])
        // Name lookups: a failure here would label every entry as unnamed.
        const lookupError = [bms, lts, allLists]
          .map((r) => ('error' in r ? r.error : null))
          .find((e) => e)
        if (lookupError) return { error: lookupError.message }
        const bmMap = new Map(
          ((bms.data ?? []) as Array<{ id: string; name: string }>).map(
            (b) => [b.id, b.name] as const
          )
        )
        const ltMap = new Map(
          (
            (lts.data ?? []) as Array<{
              id: string
              name: string
              labs: { name: string } | { name: string }[] | null
            }>
          ).map((t) => {
            return [t.id, { name: t.name, lab: firstLab(t.labs)?.name ?? null }] as const
          })
        )
        const listNameMap = new Map(
          ((allLists.data ?? []) as Array<{ id: string; name: string }>).map(
            (l) => [l.id, l.name] as const
          )
        )

        return {
          entries: list.map((r) => {
            // Custom/non-blood entries (test_type='other', dexa, microbiome,
            // dutch, genetic) have no biomarker_id/lab_test_id — their label
            // lives in custom_name. Without this branch they'd surface as an
            // unnamed lab_test.
            const kind: 'biomarker' | 'lab_test' | 'custom' = r.biomarker_id
              ? 'biomarker'
              : r.lab_test_id
                ? 'lab_test'
                : 'custom'
            const name =
              kind === 'biomarker'
                ? (bmMap.get(r.biomarker_id as string) ?? '(unknown)')
                : kind === 'lab_test'
                  ? (ltMap.get(r.lab_test_id as string)?.name ?? '(unknown)')
                  : (r.custom_name ?? r.test_type ?? '(unnamed)')
            return {
              id: r.id,
              list: listNameMap.get(r.list_id) ?? 'Unknown',
              kind,
              name,
              lab: r.lab_test_id ? (ltMap.get(r.lab_test_id)?.lab ?? null) : null,
              note: r.note,
              dueDate: r.due_date,
              status: r.status,
            }
          }),
        }
      },
    }),

    ...createAddToNextToTestTools(supabase, userId),

    mark_next_to_test_done: tool({
      description:
        'Mark a next-to-test entry as done. Use ONLY when the user explicitly confirms they have tested it; otherwise leave the entry pending.',
      inputSchema: z.object({ entryId: z.string() }),
      execute: async ({ entryId }) => {
        const upd = await supabase
          .from('next_to_test')
          .update({ status: 'done' })
          .eq('id', entryId)
          .eq('user_id', userId)
          .select()
          .single()
        if (upd.error) return { error: 'not_found' as const }
        return { ok: true as const }
      },
    }),

    remove_from_next_to_test: tool({
      description:
        "Remove a next-to-test entry by id. Use when the user changes their mind about a saved item, wants to swap it (e.g. 'I prefer Lina, not BODIMED' — remove the old entry then call add_to_next_to_test for the new lab), or asks to clear it from the list. Only the entry owner's id should be passed; the tool refuses cross-user access.",
      inputSchema: z.object({ entryId: z.string() }),
      needsApproval: true,
      execute: async ({ entryId }) => {
        // `.select().single()` so PostgREST returns PGRST116 on zero-row match
        // instead of a silent `{ error: null }` 200. Without this, the model
        // would tell the user "Done, removed" when entryId was already deleted
        // or belonged to another user. Mirrors mark_next_to_test_done above.
        const del = await supabase
          .from('next_to_test')
          .delete()
          .eq('id', entryId)
          .eq('user_id', userId)
          .select()
          .single()
        if (del.error) return { error: 'not_found' as const }
        return { ok: true as const }
      },
    }),
  }
}
