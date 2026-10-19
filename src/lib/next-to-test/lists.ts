// Next-to-test list resolution and free-text entries, shared by the lab-test
// chat tools and the next-to-test server actions. Moved from lab-test-tools.ts.

import type { TypedSupabaseClient } from '@/lib/supabase/database'

export const DEFAULT_LIST_NAME = 'Up next'

export async function ensureDefaultListId(
  supabase: TypedSupabaseClient,
  userId: string
): Promise<string> {
  const existing = await supabase
    .from('next_to_test_lists')
    .select('id')
    .eq('user_id', userId)
    .eq('name', DEFAULT_LIST_NAME)
    .maybeSingle()
  if (existing.data) return (existing.data as { id: string }).id
  const ins = await supabase
    .from('next_to_test_lists')
    .insert({ user_id: userId, name: DEFAULT_LIST_NAME })
    .select()
    .single()
  if (ins.error) {
    // Race: another concurrent call created it. Re-select.
    if ((ins.error as { code?: string }).code === '23505') {
      const again = await supabase
        .from('next_to_test_lists')
        .select('id')
        .eq('user_id', userId)
        .eq('name', DEFAULT_LIST_NAME)
        .maybeSingle()
      if (again.data) return (again.data as { id: string }).id
    }
    throw new Error(ins.error.message)
  }
  return (ins.data as { id: string }).id
}

export async function resolveListId(
  supabase: TypedSupabaseClient,
  userId: string,
  name?: string
): Promise<string> {
  if (!name) {
    const recent = await supabase
      .from('next_to_test_lists')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (recent.data) return (recent.data as { id: string }).id
    return await ensureDefaultListId(supabase, userId)
  }
  const named = await supabase
    .from('next_to_test_lists')
    .select('id')
    .eq('user_id', userId)
    .eq('name', name)
    .maybeSingle()
  if (named.data) return (named.data as { id: string }).id
  const ins = await supabase
    .from('next_to_test_lists')
    .insert({ user_id: userId, name })
    .select()
    .single()
  if (ins.error) {
    // Race: another concurrent call created the same named list.
    if ((ins.error as { code?: string }).code === '23505') {
      const again = await supabase
        .from('next_to_test_lists')
        .select('id')
        .eq('user_id', userId)
        .eq('name', name)
        .maybeSingle()
      if (again.data) return (again.data as { id: string }).id
    }
    throw new Error(ins.error.message)
  }
  return (ins.data as { id: string }).id
}

// ---- custom (free-text) next-to-test entries ----
// When a requested test resolves to NEITHER a catalogue biomarker nor an
// approved lab-test, we still save it — as a `test_type:'other'` row whose
// `custom_name` carries the user's text (the same shape the manual
// "Add → Other" dialog writes). The next_to_test_kind_chk constraint requires
// biomarker_id/lab_test_id null + a non-empty custom_name. No DB unique index
// covers custom rows, so we dedupe case-insensitively within the list here.
export type CustomInsert =
  | { added: true; id: string }
  | { duplicate: true }
  | { error: string }

export async function insertCustomEntry(
  supabase: TypedSupabaseClient,
  userId: string,
  listId: string,
  rawName: string,
  note?: string,
  dueDate?: string
): Promise<CustomInsert> {
  const customName = rawName.trim()
  if (customName.length === 0) return { error: 'invalid_arguments' }
  const { data: existing, error: existingErr } = await supabase
    .from('next_to_test')
    .select('custom_name')
    .eq('user_id', userId)
    .eq('list_id', listId)
    .eq('test_type', 'other')
    // Only dedupe against PENDING entries — a custom test the user marked
    // done should be re-addable (e.g. ordering it again for a retest).
    .eq('status', 'pending')
  // Bail on a failed dedup read instead of swallowing it — there's no DB
  // unique index on custom rows, so this query is the ONLY duplicate guard;
  // treating an error as "no matches" would silently insert a duplicate.
  if (existingErr) return { error: existingErr.message }
  const dup = ((existing ?? []) as Array<{ custom_name: string | null }>).some(
    (r) => (r.custom_name ?? '').trim().toLowerCase() === customName.toLowerCase()
  )
  if (dup) return { duplicate: true }
  const insert = await supabase
    .from('next_to_test')
    .insert({
      user_id: userId,
      list_id: listId,
      test_type: 'other',
      biomarker_id: null,
      lab_test_id: null,
      custom_name: customName,
      note: note ?? null,
      due_date: dueDate ?? null,
      status: 'pending',
    })
    .select()
    .single()
  if (insert.error) {
    if ((insert.error as { code?: string }).code === '23505') return { duplicate: true }
    return { error: insert.error.message }
  }
  return { added: true, id: (insert.data as { id: string }).id }
}
