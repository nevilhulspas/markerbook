import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ClipboardList } from 'lucide-react'

import {
  getNextToTestLists,
  getDefaultListId,
} from '@/actions/next-to-test/lists'
import { getNextToTestEntries } from '@/actions/next-to-test/entries'
import { getLabOptionsForBiomarkers } from '@/actions/next-to-test/lookup'
import type { LabOptionForBiomarker } from '@/lib/next-to-test/lab-options'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PageContainer } from '@/components/layout/page-container'
import { AddNextToTestDialog } from '@/components/next-to-test/add-next-to-test-dialog'
import { GeneratePdfButton } from '@/components/next-to-test/generate-pdf-button'
import { ListTabManager } from '@/components/next-to-test/list-tab-manager'
import { EntryTable } from '@/components/next-to-test/entry-table'
import {
  StatusFilterDropdown,
  SourceFilterDropdown,
  CategoryFilterDropdown,
  type SortKey,
  type SortOrder,
} from '@/components/next-to-test/table-controls'
import type { NextToTest, NextToTestType } from '@/lib/database.types'
import { appTodayISO } from '@/lib/dates/today'

const ANY_LAB_LABEL = 'Any lab'

// Display labels for each test_type — used as the row's `name` when the
// non-blood categories don't have a user-supplied custom_name, and as the
// header above each category group on the page.
const CATEGORY_LABEL: Record<NextToTestType, string> = {
  blood_biomarker: 'Blood biomarker',
  blood_lab_test: 'Blood lab test',
  dexa: 'DEXA scan',
  microbiome: 'Microbiome test',
  dutch: 'DUTCH hormone test',
  genetic: 'Genetic test',
  other: 'Other',
}

// Page-side row grouping. blood_biomarker and blood_lab_test share a
// "Blood markers" group because the user already sees the per-row biomarker
// vs lab_test distinction in the Source column — splitting them visually
// would just duplicate that signal.
type CategoryGroup = 'blood' | 'dexa' | 'microbiome' | 'dutch' | 'genetic' | 'other'

const CATEGORY_GROUP_LABEL: Record<CategoryGroup, string> = {
  blood: 'Blood markers',
  dexa: 'Body composition (DEXA)',
  microbiome: 'Microbiome',
  dutch: 'DUTCH hormones',
  genetic: 'Genetics',
  other: 'Other',
}

// Display order of the category groups on the page. Blood first because
// it's the dominant data shape; "Other" last so unknown items don't crowd
// out structured ones at the top.
const CATEGORY_GROUP_ORDER: CategoryGroup[] = [
  'blood',
  'dexa',
  'microbiome',
  'dutch',
  'genetic',
  'other',
]

function groupOf(t: NextToTestType): CategoryGroup {
  if (t === 'blood_biomarker' || t === 'blood_lab_test') return 'blood'
  return t
}

interface PageProps {
  searchParams: Promise<{
    list?: string
    status?: 'pending' | 'done' | 'all'
    sort?: SortKey
    order?: SortOrder
    source?: string // comma-separated source labels
    category?: string // comma-separated category-group keys
  }>
}

// Row shape after we've joined biomarker / lab_test names and the per-row
// lab options for the inline source picker. `canonicalBiomarkerId` is the
// biomarker the row currently tracks (direct for biomarker rows, first
// mapping for lab_test rows when exactly one exists). It's the input the
// SourceCellPicker uses to convert lab_test → biomarker via "Any lab".
// Non-blood test types carry null in the blood-specific slots and use
// `name` (= custom_name override or the category label) as the row label.
type EntryWithResolved = {
  id: string
  list_id: string
  test_type: NextToTestType
  name: string
  lab_name: string | null
  source_label: string
  canonical_biomarker_id: string | null
  current_lab_test_id: string | null
  note: string | null
  due_date: string | null
  status: 'pending' | 'done'
  created_at: string
  lab_options: LabOptionForBiomarker[]
}

async function resolveEntries(
  entries: NextToTest[]
): Promise<EntryWithResolved[]> {
  if (entries.length === 0) return []
  const biomarkerIds = entries
    .filter((e) => e.biomarker_id)
    .map((e) => e.biomarker_id as string)
  const labTestIds = entries
    .filter((e) => e.lab_test_id)
    .map((e) => e.lab_test_id as string)
  // Three joins fan out from the entry set, parallelised:
  //  1. biomarker names for biomarker rows
  //  2. lab_test names + lab names for lab_test rows
  //  3. the FIRST biomarker mapping for each lab_test (used as the canonical
  //     biomarker the row tracks, so unpinning back to "Any lab" works)
  const [bms, lts, ltbm] = await Promise.all([
    biomarkerIds.length === 0
      ? Promise.resolve({ data: [] as Array<{ id: string; name: string }> })
      : supabaseAdmin
          .from('biomarkers')
          .select('id, name')
          .in('id', biomarkerIds)
          .is('archived_at', null),
    labTestIds.length === 0
      ? Promise.resolve({
          data: [] as Array<{
            id: string
            name: string
            labs: { name: string }
          }>,
        })
      : supabaseAdmin
          .from('lab_tests')
          .select('id, name, labs(name)')
          .in('id', labTestIds)
          .eq('status', 'approved'),
    labTestIds.length === 0
      ? Promise.resolve({
          data: [] as Array<{ lab_test_id: string; biomarker_id: string }>,
        })
      : supabaseAdmin
          .from('lab_test_biomarkers')
          .select('lab_test_id, biomarker_id')
          .in('lab_test_id', labTestIds),
  ])
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
        labs: { name: string } | null
      }>
    ).map(
      (t) =>
        [t.id, { name: t.name, labName: t.labs?.name ?? null }] as const
    )
  )
  // For each lab_test, pick the FIRST biomarker mapping. Multi-marker tests
  // (Leukogram → 6 markers) will track only the first when unpinned. The
  // picker discloses that in the dropdown, so users know what they'll get.
  const ltBiomarkerMap = new Map<string, string>()
  for (const row of (ltbm.data ?? []) as Array<{
    lab_test_id: string
    biomarker_id: string
  }>) {
    if (!ltBiomarkerMap.has(row.lab_test_id)) {
      ltBiomarkerMap.set(row.lab_test_id, row.biomarker_id)
    }
  }

  // Now collect ALL canonical biomarker ids (direct + lab_test-derived) and
  // batch-fetch lab options in one query. Pass the user's currently-pinned
  // lab_test_ids as `preferred` so the dedup keeps the row's actual selection
  // (otherwise a row on "City Lab — Vitamin panel" would show the
  // default "City Lab — Vitamin B1" winner, hiding what the user picked).
  const canonicalIds = Array.from(
    new Set([
      ...biomarkerIds,
      ...Array.from(ltBiomarkerMap.values()),
    ])
  )
  const preferredLabTestIds = labTestIds
  const optionsByBiomarker = await getLabOptionsForBiomarkers(
    canonicalIds,
    preferredLabTestIds
  )

  return entries.map((e) => {
    // Blood biomarker — lab-agnostic, lab_options drive the source picker.
    if (e.test_type === 'blood_biomarker' && e.biomarker_id) {
      const name =
        e.custom_name?.trim() ||
        bmMap.get(e.biomarker_id) ||
        '(unknown biomarker)'
      return {
        id: e.id,
        list_id: e.list_id,
        test_type: e.test_type,
        name,
        lab_name: null,
        source_label: ANY_LAB_LABEL,
        canonical_biomarker_id: e.biomarker_id,
        current_lab_test_id: null,
        note: e.note,
        due_date: e.due_date,
        status: e.status,
        created_at: e.created_at,
        lab_options: optionsByBiomarker[e.biomarker_id] ?? [],
      }
    }
    // Blood lab_test — pinned to a specific lab.
    if (e.test_type === 'blood_lab_test' && e.lab_test_id) {
      const lt = ltMap.get(e.lab_test_id)
      const canonicalBm = ltBiomarkerMap.get(e.lab_test_id) ?? null
      return {
        id: e.id,
        list_id: e.list_id,
        test_type: e.test_type,
        name: e.custom_name?.trim() || lt?.name || '(unknown test)',
        lab_name: lt?.labName ?? null,
        source_label: lt?.labName ?? '—',
        canonical_biomarker_id: canonicalBm,
        current_lab_test_id: e.lab_test_id,
        note: e.note,
        due_date: e.due_date,
        status: e.status,
        created_at: e.created_at,
        lab_options: canonicalBm
          ? (optionsByBiomarker[canonicalBm] ?? [])
          : [],
      }
    }
    // Non-blood (dexa / microbiome / dutch / genetic / other). The custom
    // name takes priority over the category default so users can disambiguate
    // multiple entries in the same category ("DEXA at HumanFitness" vs
    // "DEXA at SomaSimple"). Source column is dashed — these tests aren't
    // mapped to a per-lab catalogue, the user picks the provider in person.
    return {
      id: e.id,
      list_id: e.list_id,
      test_type: e.test_type,
      name: e.custom_name?.trim() || CATEGORY_LABEL[e.test_type],
      lab_name: null,
      source_label: '—',
      canonical_biomarker_id: null,
      current_lab_test_id: null,
      note: e.note,
      due_date: e.due_date,
      status: e.status,
      created_at: e.created_at,
      lab_options: [],
    }
  })
}

function parseSort(sp: { sort?: string; order?: string }): {
  sort: SortKey
  order: SortOrder
} {
  // Default A→Z by name (more useful than "Added desc" for a list
  // that grows organically). Server treats a missing ?sort= as name; the
  // client EntryTable layer restores any previously-saved preference from
  // localStorage on mount so user choices survive across sessions.
  const sort: SortKey =
    sp.sort === 'name' ||
    sp.sort === 'due' ||
    sp.sort === 'source' ||
    sp.sort === 'status' ||
    sp.sort === 'created'
      ? sp.sort
      : 'name'
  const order: SortOrder = sp.order === 'desc' ? 'desc' : 'asc'
  return { sort, order }
}

function compareEntries(
  a: EntryWithResolved,
  b: EntryWithResolved,
  key: SortKey
): number {
  switch (key) {
    case 'name':
      return a.name.localeCompare(b.name)
    case 'due': {
      // NULL due dates sort to the bottom in ascending order — same rule
      // getNextToTestEntries already applies server-side for the default.
      const al = a.due_date ?? '￿'
      const bl = b.due_date ?? '￿'
      return al.localeCompare(bl)
    }
    case 'source':
      return a.source_label.localeCompare(b.source_label)
    case 'status':
      // pending before done in ascending (semantically "open work first").
      if (a.status === b.status) return 0
      return a.status === 'pending' ? -1 : 1
    case 'created':
    default:
      return a.created_at.localeCompare(b.created_at)
  }
}

export const metadata: Metadata = {
  title: 'Next to test | Markerbook',
}

export default async function NextToTestPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const status: 'pending' | 'done' | 'all' =
    sp.status === 'done' || sp.status === 'all' ? sp.status : 'pending'
  const { sort, order } = parseSort(sp)
  const sourceFilter = (sp.source ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const categoryFilter = (sp.category ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is CategoryGroup =>
      (CATEGORY_GROUP_ORDER as string[]).includes(s)
    )

  const lists = await getNextToTestLists()
  let activeListId = sp.list
  if (!activeListId) {
    if (lists.length === 0) {
      const defaultId = await getDefaultListId()
      redirect(`/next-to-test?list=${defaultId}`)
    }
    activeListId = lists[lists.length - 1].id
  }
  const entries = await getNextToTestEntries(activeListId, { status })
  const resolved = await resolveEntries(entries)

  // Distinct source chips for the filter — drive directly from the loaded
  // entries so the chip set reflects what's actually present.
  const distinctSources = Array.from(
    new Set(resolved.map((e) => e.source_label))
  ).sort((a, b) => a.localeCompare(b))

  // Category options for the filter come from the actual entry set so empty
  // categories don't crowd the dropdown.
  const distinctCategories: CategoryGroup[] = Array.from(
    new Set(resolved.map((e) => groupOf(e.test_type)))
  ).sort(
    (a, b) =>
      CATEGORY_GROUP_ORDER.indexOf(a) - CATEGORY_GROUP_ORDER.indexOf(b)
  )

  // Apply category + source filters (if any) then sort.
  const filtered = resolved.filter((e) => {
    if (
      sourceFilter.length > 0 &&
      !sourceFilter.includes(e.source_label)
    )
      return false
    if (
      categoryFilter.length > 0 &&
      !categoryFilter.includes(groupOf(e.test_type))
    )
      return false
    return true
  })
  const sorted = [...filtered].sort((a, b) => {
    const c = compareEntries(a, b, sort)
    return order === 'asc' ? c : -c
  })
  // Group by category group, preserving the user's sort within each group.
  // We walk CATEGORY_GROUP_ORDER so the page renders categories in a stable
  // order (Blood → DEXA → Microbiome → DUTCH → Genetics → Other).
  const groupedRows = CATEGORY_GROUP_ORDER.map((g) => ({
    group: g,
    label: CATEGORY_GROUP_LABEL[g],
    rows: sorted.filter((e) => groupOf(e.test_type) === g),
  })).filter((g) => g.rows.length > 0)

  // Slim, serialisable shape for the client PDF button — only the fields the
  // PDF renders. Mirrors the on-screen grouping/filtering/sort exactly because
  // it's built from the same `groupedRows`.
  const pdfGroups = groupedRows.map((g) => ({
    label: g.label,
    rows: g.rows.map((r) => ({
      name: r.name,
      source_label: r.source_label,
      note: r.note,
      due_date: r.due_date,
      status: r.status,
    })),
  }))
  const activeListName =
    lists.find((l) => l.id === activeListId)?.name ?? 'Next to test'

  const today = appTodayISO()

  // Build the canonical search-param string the SortableHeaderLink uses to
  // synthesize its `href` (so the next sort URL preserves list, status,
  // source, etc.). Re-built from the parsed values so default-valued params
  // get stripped consistently with useUrlUpdate() on the client.
  const headerParams = new URLSearchParams()
  if (sp.list) headerParams.set('list', sp.list)
  if (status !== 'pending') headerParams.set('status', status)
  if (sourceFilter.length > 0)
    headerParams.set('source', sourceFilter.join(','))
  if (categoryFilter.length > 0)
    headerParams.set('category', categoryFilter.join(','))
  // Always include sort + order in the link-base params so the URL stays
  // explicit about the user's choice — the persistence layer relies on
  // "URL has sort/order" to distinguish a deliberate click from a fresh
  // visit.
  headerParams.set('sort', sort)
  headerParams.set('order', order)
  const headerParamsString = headerParams.toString()

  return (
    <PageContainer width="default" className="space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="text-primary size-6" />
        <h1 className="text-3xl font-bold tracking-tight">Next to test</h1>
      </div>

      {/* Tabs + list management */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        {lists.map((l) => (
          <Link
            key={l.id}
            href={`/next-to-test?list=${l.id}`}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              l.id === activeListId
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {l.name}
          </Link>
        ))}
        <ListTabManager lists={lists} activeListId={activeListId} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusFilterDropdown status={status} />
          <CategoryFilterDropdown
            categories={distinctCategories.map((g) => ({
              value: g,
              label: CATEGORY_GROUP_LABEL[g],
            }))}
            active={categoryFilter}
          />
          <SourceFilterDropdown sources={distinctSources} active={sourceFilter} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GeneratePdfButton groups={pdfGroups} listName={activeListName} />
          <AddNextToTestDialog lists={lists} defaultListId={activeListId} />
        </div>
      </div>

      {/* Entry table */}
      {sorted.length === 0 ? (
        <p className="bg-muted/30 rounded-lg border p-6 text-center text-sm text-muted-foreground">
          {resolved.length === 0
            ? status === 'pending'
              ? 'Nothing pending. Add a test from a biomarker page, lab page, or just ask in Chat.'
              : status === 'done'
                ? 'No done entries yet.'
                : 'This list is empty.'
            : 'No entries match your filter.'}
        </p>
      ) : (
        <EntryTable
          groupedRows={groupedRows}
          lists={lists}
          currentListId={activeListId}
          today={today}
          sort={sort}
          order={order}
          headerParamsString={headerParamsString}
        />
      )}
    </PageContainer>
  )
}
