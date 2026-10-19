// Shared "add one item to a next-to-test list" logic for the single
// (add_to_next_to_test) and batch (add_many_to_next_to_test) chat tools. Each
// helper resolves one name against a pre-fetched catalogue and inserts the
// entry; the tools map the returned outcome to their own result shapes.

import type { TypedSupabaseClient } from '@/lib/supabase/database'

import {
  firstLab,
  preferSampleType,
  resolveBestMatch,
  scoreNameMatch,
  type SampleTypeHint,
} from '@/lib/labs/name-match'
import { insertCustomEntry, type CustomInsert } from '@/lib/next-to-test/lists'
import { fetchAllPages, type AllRowsResult } from '@/lib/supabase/fetch-all-pages'

export interface BiomarkerRow {
  id: string
  name: string
  short_name: string | null
}

export interface LabTestRow {
  id: string
  name: string
  sample_type: string | null
  labs: { name: string } | { name: string }[]
}

export type EntryKind = 'biomarker' | 'lab_test' | 'custom'

/** What happened to one requested item, before a tool shapes its result. */
export type AddItemOutcome =
  | { status: 'added'; kind: EntryKind; id: string; name: string; lab: string | null }
  | { status: 'duplicate'; kind: EntryKind; name: string; lab: string | null }
  | { status: 'ambiguous'; candidates: string[] }
  | { status: 'error'; message: string }

export interface AddItemContext {
  supabase: TypedSupabaseClient
  userId: string
  /**
   * The target list's id. Called only right before an insert, so the single
   * tool resolves (and possibly creates) the list lazily — an ambiguous item
   * creates no list. The batch tool resolves once up front and returns that.
   */
  getListId: () => Promise<string>
  note?: string
  dueDate?: string
}

/** A catalogue read: every row, or the error that stopped it. A failed read
 * must not look like a short catalogue: every name past the gap would be saved
 * as a custom entry or reported as not found. */
export type CatalogueResult<T> = AllRowsResult<T>

/** The biomarker catalogue, for scoring lab-agnostic names. */
export async function fetchBiomarkerRows(
  supabase: TypedSupabaseClient
): Promise<CatalogueResult<BiomarkerRow>> {
  return fetchAllPages<BiomarkerRow>((from, to) =>
    supabase.from('biomarkers').select('id, name, short_name').order('id').range(from, to)
  )
}

/**
 * Approved lab tests at approved labs. Also pulls sample_type so the AUT-854
 * sampleType hint can narrow the candidate set via the lab_tests.sample_type
 * field (free-text: 'blood' / 'Venous blood' / 'urine' / 'stool' / …).
 */
export async function fetchLabTestRows(
  supabase: TypedSupabaseClient
): Promise<CatalogueResult<LabTestRow>> {
  return fetchAllPages<LabTestRow>(
    (from, to) =>
      supabase
        .from('lab_tests')
        .select('id, name, sample_type, labs!inner(name, status)')
        .eq('status', 'approved')
        .eq('labs.status', 'approved')
        .order('id')
        .range(from, to)
  )
}

/**
 * Add a lab-agnostic name: a catalogue biomarker when it resolves to one, else
 * a free-text custom entry (an ambiguous match is reported, not saved).
 */
export async function addBiomarkerItem(
  ctx: AddItemContext,
  rows: BiomarkerRow[],
  name: string,
  sampleType: SampleTypeHint | undefined
): Promise<AddItemOutcome> {
  // Narrow by sample-type intent so urine/saliva variants don't
  // ambiguity-collide with blood when the AI passed sampleType.
  const narrowed = preferSampleType(rows, (b) => b.name, sampleType)
  const resolved = resolveBestMatch(narrowed, name, (b) =>
    b.short_name ? [b.name, b.short_name] : [b.name]
  )
  if ('none' in resolved) {
    // Not in the biomarker catalogue → auto-save as a free-text custom entry
    // rather than rejecting. (Ambiguous still prompts below.)
    const listId = await ctx.getListId()
    const res = await insertCustomEntry(ctx.supabase, ctx.userId, listId, name, ctx.note, ctx.dueDate)
    return customOutcome(res, name.trim(), null)
  }
  if ('ambiguous' in resolved) {
    return { status: 'ambiguous', candidates: resolved.ambiguous.map((m) => m.name) }
  }
  const winner = resolved.unique
  const listId = await ctx.getListId()
  return insertCatalogueEntry(ctx, listId, 'biomarker', winner.id, winner.name, null)
}

/**
 * Add a test pinned to a lab: an approved lab test when it resolves to one at
 * that lab, else a free-text custom entry noting the requested lab.
 */
export async function addLabTestItem(
  ctx: AddItemContext,
  rows: LabTestRow[],
  labName: string,
  testName: string,
  sampleType: SampleTypeHint | undefined
): Promise<AddItemOutcome> {
  // Pre-filter to rows whose lab matches the requested labName, then
  // score within that subset on testName. Two-stage so a strong test
  // match at the wrong lab can't beat a weaker test match at the right
  // lab — labName is a hard filter, testName is the rankable signal.
  const labFiltered = rows.filter((t) => scoreNameMatch(firstLab(t.labs)?.name ?? '', labName) > 0)
  // Then narrow by sample-type intent. The check runs against
  // sample_type when present, falling back to the test name itself
  // (some catalogue rows leave sample_type null but tag the name).
  const sampleFiltered = preferSampleType(
    labFiltered,
    (t) => `${t.sample_type ?? ''} ${t.name}`,
    sampleType
  )
  const resolved = resolveBestMatch(
    sampleFiltered,
    testName,
    (t) => [t.name],
    // Tie-break by id when same-name duplicates slip through (e.g. a
    // pending-status row that the unique index doesn't cover).
    (a, b) => a.id.localeCompare(b.id)
  )
  if ('none' in resolved) {
    // Test not found at the named lab in our catalogue → auto-save as a
    // free-text custom entry. Custom 'other' rows can't hold a lab link,
    // so keep the requested lab in the note for context.
    const listId = await ctx.getListId()
    const customNote = ctx.note
      ? `${ctx.note} (lab requested: ${labName})`
      : `Lab requested: ${labName}`
    const res = await insertCustomEntry(ctx.supabase, ctx.userId, listId, testName, customNote, ctx.dueDate)
    return customOutcome(res, testName.trim(), labName)
  }
  if ('ambiguous' in resolved) {
    return {
      status: 'ambiguous',
      candidates: resolved.ambiguous.map((m) => `${m.name} (${firstLab(m.labs)?.name ?? ''})`),
    }
  }
  const winner = resolved.unique
  const listId = await ctx.getListId()
  return insertCatalogueEntry(
    ctx,
    listId,
    'lab_test',
    winner.id,
    winner.name,
    firstLab(winner.labs)?.name ?? null
  )
}

function customOutcome(res: CustomInsert, name: string, lab: string | null): AddItemOutcome {
  if ('added' in res) return { status: 'added', kind: 'custom', id: res.id, name, lab }
  if ('duplicate' in res) return { status: 'duplicate', kind: 'custom', name, lab }
  return { status: 'error', message: res.error }
}

/** Insert a catalogue-linked entry (a biomarker or an approved lab test). */
async function insertCatalogueEntry(
  ctx: AddItemContext,
  listId: string,
  kind: 'biomarker' | 'lab_test',
  catalogueId: string,
  name: string,
  lab: string | null
): Promise<AddItemOutcome> {
  const insert = await ctx.supabase
    .from('next_to_test')
    .insert({
      user_id: ctx.userId,
      list_id: listId,
      test_type: kind === 'biomarker' ? 'blood_biomarker' : 'blood_lab_test',
      biomarker_id: kind === 'biomarker' ? catalogueId : null,
      lab_test_id: kind === 'lab_test' ? catalogueId : null,
      note: ctx.note ?? null,
      due_date: ctx.dueDate ?? null,
      status: 'pending',
    })
    .select()
    .single()
  if (insert.error) {
    if ((insert.error as { code?: string }).code === '23505') {
      return { status: 'duplicate', kind, name, lab }
    }
    return { status: 'error', message: insert.error.message }
  }
  return { status: 'added', kind, id: (insert.data as { id: string }).id, name, lab }
}
