import { tool } from 'ai'
import { z } from 'zod'
import type { TypedSupabaseClient } from '@/lib/supabase/database'

import { normalizeUnit } from '@/lib/grid/unit-conversion'
import type { Biomarker, ChatAttachment } from '@/lib/database.types'
import {
  markerInputSchema,
  resolveMarkerInputs,
  resolveMarkerInputsViaLoinc,
  type ResolvedMarker,
} from './marker-inputs'
import { HEALTH_TEST_TABLES } from './health-test-tools'

/**
 * Blood-test tools for the insights chat (tests + per-marker results), plus
 * linking an uploaded file to any record. Part of `createHealthRecordTools` —
 * same client and user scoping rules apply.
 */
export function createBloodTestTools(
  supabase: TypedSupabaseClient,
  userId: string,
  attachments: ChatAttachment[]
) {
  const loadCatalog = async (): Promise<Biomarker[]> => {
    const { data, error } = await supabase
      .from('biomarkers')
      .select('*')
      .is('archived_at', null)
    // Fail loud: a silent [] would send every marker through LOINC resolution and
    // could capture a duplicate of an existing (null-loinc_code) catalog row.
    if (error) throw new Error(`Failed to load biomarker catalog: ${error.message}`)
    return (data ?? []) as Biomarker[]
  }

  /** Canonical unit spellings per biomarker (so "ng/ml" stores as "ng/mL"). */
  const canonicalizeUnits = async (markers: ResolvedMarker[]): Promise<ResolvedMarker[]> => {
    const ids = markers.map((m) => m.biomarker_id)
    const { data: bmUnits } = await supabase
      .from('biomarker_units')
      .select('biomarker_id, unit')
      .in('biomarker_id', ids)
    const byBiomarker = new Map<string, string[]>()
    for (const u of bmUnits ?? []) {
      const list = byBiomarker.get(u.biomarker_id) ?? []
      list.push(u.unit)
      byBiomarker.set(u.biomarker_id, list)
    }
    return markers.map((m) => {
      const available = byBiomarker.get(m.biomarker_id) ?? []
      const canonical = available.find((u) => normalizeUnit(u) === normalizeUnit(m.unit))
      return { ...m, unit: canonical ?? m.unit }
    })
  }

  const ownBloodTest = async (testId: string) => {
    const { data } = await supabase
      .from('blood_tests')
      .select('id, name, test_date')
      .eq('id', testId)
      .eq('user_id', userId)
      .maybeSingle()
    return data as { id: string; name: string; test_date: string } | null
  }

  return {
    list_blood_tests: tool({
      description:
        "List the user's logged blood tests (id, name, date, sample type, marker count), newest first. Freely callable — call this FIRST to get test ids before reading, editing or deleting, and to check whether a test already exists on a date before creating a new one.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data, error } = await supabase
          .from('blood_tests')
          .select('id, name, test_date, sample_type, notes, test_results(id)')
          .eq('user_id', userId)
          .order('test_date', { ascending: false })
          .limit(100)
        if (error) return { error: error.message }
        const tests = (data ?? []).map((t) => {
          const { test_results, ...rest } = t as typeof t & { test_results: { id: string }[] }
          return { ...rest, result_count: Array.isArray(test_results) ? test_results.length : 0 }
        })
        return { tests }
      },
    }),

    get_blood_test: tool({
      description:
        'Read one blood test with ALL its marker results (catalog marker name, value, unit). Freely callable. Use the exact returned marker names when correcting or removing results.',
      inputSchema: z.object({ testId: z.string() }),
      execute: async ({ testId }) => {
        const { data, error } = await supabase
          .from('blood_tests')
          .select('id, name, test_date, sample_type, notes, test_results(value, unit, biomarkers(name))')
          .eq('id', testId)
          .eq('user_id', userId)
          .maybeSingle()
        if (error) return { error: error.message }
        if (!data) return { error: 'Blood test not found.' }
        const { test_results, ...test } = data
        const results = (test_results ?? [])
          .map((r) => ({ marker: r.biomarkers?.name ?? 'unknown', value: r.value, unit: r.unit }))
          .sort((a, b) => a.marker.localeCompare(b.marker))
        return { test, results }
      },
    }),

    create_blood_test: tool({
      description:
        'Create a NEW blood test with marker results (markers passed by name; matching is automatic — markers are matched to your catalog, resolved to a standard code, or, if neither works, added as a CUSTOM marker, so nothing is dropped). Use ONLY when no test exists for that date — if one does, prefer add_blood_results on it. If a same-date test exists this tool refuses unless `allowDuplicateDate` is true (set it only after the user explicitly chose a separate test). Names in `custom` were added as new custom markers — mention them to the user as "added as a custom marker" (never say "LOINC"). Only genuine failures (empty name / DB error) come back in `unmatched`.',
      inputSchema: z.object({
        test_date: z.string().date().describe('YYYY-MM-DD'),
        name: z.string().max(200).optional().describe('Defaults to "Blood test <date>".'),
        sample_type: z.enum(['serum', 'plasma', 'unknown']).optional(),
        notes: z.string().max(1000).optional(),
        markers: z.array(markerInputSchema).min(1),
        allowDuplicateDate: z.boolean().optional(),
      }),
      execute: async ({ test_date, name, sample_type, notes, markers, allowDuplicateDate }) => {
        const { data: sameDate } = await supabase
          .from('blood_tests')
          .select('id, name, test_date')
          .eq('user_id', userId)
          .eq('test_date', test_date)
        if (sameDate && sameDate.length > 0 && !allowDuplicateDate) {
          return {
            error: 'A blood test already exists on this date. Use add_blood_results to add to it, or pass allowDuplicateDate: true if the user explicitly wants a separate test.',
            existing: sameDate,
          }
        }

        const { resolved, unmatched, custom } = await resolveMarkerInputsViaLoinc(markers, await loadCatalog(), supabase)
        if (resolved.length === 0) {
          return { error: 'None of the markers could be saved (empty names or a database error).', unmatched }
        }
        const canonical = await canonicalizeUnits(resolved)

        const { data: test, error: testError } = await supabase
          .from('blood_tests')
          .insert({
            user_id: userId,
            name: name ?? `Blood test ${test_date}`,
            test_date,
            sample_type: sample_type ?? 'unknown',
            notes: notes ?? null,
          })
          .select('id')
          .single()
        if (testError || !test) return { error: testError?.message ?? 'Failed to create test.' }

        const { error: resultsError } = await supabase.from('test_results').insert(
          canonical.map((m) => ({
            blood_test_id: test.id,
            biomarker_id: m.biomarker_id,
            value: m.value,
            unit: m.unit,
          }))
        )
        if (resultsError) {
          // Keep the DB clean — no empty test shell on a failed insert.
          await supabase.from('blood_tests').delete().eq('id', test.id).eq('user_id', userId)
          return { error: resultsError.message }
        }
        return {
          testId: test.id as string,
          href: `/tests/${test.id}`,
          added: canonical.map((m) => ({ marker: m.name, value: m.value, unit: m.unit })),
          custom,
          unmatched,
        }
      },
    }),

    add_blood_results: tool({
      description:
        'Add marker results to an EXISTING blood test (get the id from list_blood_tests). Markers already on the test get their value REPLACED (use this to correct wrong values or complete a partial test — e.g. "the remaining results from June 1st"); new markers are added. Matching is automatic: catalog match, standard-code resolve, or, failing both, added as a CUSTOM marker. Deduplication is automatic. Names in `custom` were added as new custom markers — mention them to the user as "added as a custom marker" (never say "LOINC"). Only genuine failures come back in `unmatched`.',
      inputSchema: z.object({
        testId: z.string(),
        markers: z.array(markerInputSchema).min(1),
      }),
      execute: async ({ testId, markers }) => {
        const test = await ownBloodTest(testId)
        if (!test) return { error: 'Blood test not found.' }

        const { resolved, unmatched, custom } = await resolveMarkerInputsViaLoinc(markers, await loadCatalog(), supabase)
        if (resolved.length === 0) {
          return { error: 'None of the markers could be saved (empty names or a database error).', unmatched }
        }
        const canonical = await canonicalizeUnits(resolved)

        const { data: existingResults } = await supabase
          .from('test_results')
          .select('id, biomarker_id')
          .eq('blood_test_id', testId)
          .in('biomarker_id', canonical.map((m) => m.biomarker_id))
        const existingByBiomarker = new Map<string, string>()
        for (const r of existingResults ?? []) existingByBiomarker.set(r.biomarker_id, r.id)

        const added: Array<{ marker: string; value: number; unit: string }> = []
        const replaced: Array<{ marker: string; value: number; unit: string }> = []
        const inserts: Array<{ blood_test_id: string; biomarker_id: string; value: number; unit: string }> = []

        for (const m of canonical) {
          const existingId = existingByBiomarker.get(m.biomarker_id)
          if (existingId) {
            const { error } = await supabase
              .from('test_results')
              .update({ value: m.value, unit: m.unit })
              .eq('id', existingId)
            if (error) return { error: error.message }
            replaced.push({ marker: m.name, value: m.value, unit: m.unit })
          } else {
            inserts.push({ blood_test_id: testId, biomarker_id: m.biomarker_id, value: m.value, unit: m.unit })
            added.push({ marker: m.name, value: m.value, unit: m.unit })
          }
        }
        if (inserts.length > 0) {
          const { error } = await supabase.from('test_results').insert(inserts)
          if (error) return { error: error.message }
        }
        return { testId, test: { name: test.name, test_date: test.test_date }, added, replaced, custom, unmatched }
      },
    }),

    remove_blood_results: tool({
      description:
        'Remove specific marker results from a blood test by marker name (e.g. a marker logged by mistake). The test itself stays. Use only on explicit user request.',
      inputSchema: z.object({
        testId: z.string(),
        markerNames: z.array(z.string().min(1)).min(1),
      }),
      execute: async ({ testId, markerNames }) => {
        const test = await ownBloodTest(testId)
        if (!test) return { error: 'Blood test not found.' }

        const { resolved, unmatched } = resolveMarkerInputs(
          markerNames.map((name) => ({ name, value: 0 })),
          await loadCatalog()
        )
        if (resolved.length === 0) return { error: 'No marker names matched the catalog.', unmatched }

        const { data: rows } = await supabase
          .from('test_results')
          .select('id, biomarker_id')
          .eq('blood_test_id', testId)
          .in('biomarker_id', resolved.map((m) => m.biomarker_id))
        const onTest = new Set((rows ?? []).map((r) => r.biomarker_id))
        const removable = resolved.filter((m) => onTest.has(m.biomarker_id))
        const notOnTest = resolved.filter((m) => !onTest.has(m.biomarker_id)).map((m) => m.name)

        if (removable.length > 0) {
          const { error } = await supabase
            .from('test_results')
            .delete()
            .eq('blood_test_id', testId)
            .in('biomarker_id', removable.map((m) => m.biomarker_id))
          if (error) return { error: error.message }
        }
        return { removed: removable.map((m) => m.name), notOnTest, unmatched }
      },
    }),

    update_blood_test: tool({
      description:
        "Update a blood test's metadata (name, date, sample type, notes) — marker results stay untouched. Only the provided fields change.",
      inputSchema: z.object({
        testId: z.string(),
        name: z.string().max(200).optional(),
        test_date: z.string().date().optional(),
        sample_type: z.enum(['serum', 'plasma', 'unknown']).optional(),
        notes: z.string().max(1000).nullable().optional(),
      }),
      execute: async ({ testId, ...patch }) => {
        const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
        if (Object.keys(clean).length === 0) return { error: 'No fields to update.' }
        const { data, error } = await supabase
          .from('blood_tests')
          .update({ ...clean, updated_at: new Date().toISOString() })
          .eq('id', testId)
          .eq('user_id', userId)
          .select('id')
        if (error) return { error: error.message }
        if (!data || data.length === 0) return { error: 'Blood test not found.' }
        return { updated: testId }
      },
    }),

    delete_blood_test: tool({
      description:
        'Delete a whole blood test and ALL its marker results. IRREVERSIBLE — only after the user explicitly confirmed deleting THIS test (restate its name + date first).',
      inputSchema: z.object({ testId: z.string() }),
      execute: async ({ testId }) => {
        const test = await ownBloodTest(testId)
        if (!test) return { error: 'Blood test not found.' }
        // Interpretations reference the test without ON DELETE CASCADE.
        await supabase.from('interpretations').delete().eq('blood_test_id', testId)
        const { error } = await supabase
          .from('blood_tests')
          .delete()
          .eq('id', testId)
          .eq('user_id', userId)
        return error
          ? { error: error.message }
          : { deleted: { id: testId, name: test.name, test_date: test.test_date } }
      },
    }),

    attach_document_to_record: tool({
      description:
        "Link the file uploaded on THIS message (PDF or image) to an existing record (blood / DEXA / microbiome / DUTCH / RMR test) as its source document, REPLACING any previously linked file. Results are NOT changed — to also update results from a fuller report, additionally call add_blood_results. If the record already has a linked file, confirm the replacement with the user first.",
      inputSchema: z.object({
        recordType: z.enum(['blood', 'dexa', 'microbiome', 'dutch', 'rmr']),
        recordId: z.string(),
        attachmentIndex: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Which attachment on the message (0-based). Defaults to the last one.'),
      }),
      execute: async ({ recordType, recordId, attachmentIndex }) => {
        const att = attachments[attachmentIndex ?? attachments.length - 1]
        if (!att) return { error: 'No file attached to this message.' }
        if (!att.storagePath.startsWith(`${userId}/`)) {
          return { error: 'This file is not authorized for your account.' }
        }
        const table = recordType === 'blood' ? 'blood_tests' : HEALTH_TEST_TABLES[recordType].table
        const { data: existing } = await supabase
          .from(table)
          .select('id, pdf_storage_path')
          .eq('id', recordId)
          .eq('user_id', userId)
          .maybeSingle()
        if (!existing) return { error: 'Record not found.' }
        const { error } = await supabase
          .from(table)
          .update({ pdf_storage_path: att.storagePath, updated_at: new Date().toISOString() })
          .eq('id', recordId)
          .eq('user_id', userId)
        if (error) return { error: error.message }
        return {
          linked: att.filename,
          recordId,
          replacedPreviousDocument: Boolean(existing.pdf_storage_path),
        }
      },
    }),
  }
}
