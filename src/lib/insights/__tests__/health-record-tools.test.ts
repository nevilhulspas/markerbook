import { describe, it, expect, vi, beforeEach } from 'vitest'

// The LOINC-routed resolver delegates to resolveMarker/commitCapture. Mock them
// so the orchestration (matched/captured/unresolved → resolved+unmatched, dedup,
// per-marker error isolation) is tested without a live DB / NLM / Anthropic.
vi.mock('@/lib/loinc/resolve', () => ({
  resolveMarker: vi.fn(),
  commitCapture: vi.fn(),
  commitCustomCapture: vi.fn(),
}))

import {
  createHealthRecordTools,
  resolveMarkerInputs,
  resolveMarkerInputsViaLoinc,
} from '../health-record-tools'
import { resolveMarker, commitCapture, commitCustomCapture } from '@/lib/loinc/resolve'
import type { Biomarker } from '@/lib/database.types'

const mockResolveMarker = vi.mocked(resolveMarker)
const mockCommitCapture = vi.mocked(commitCapture)
const mockCommitCustomCapture = vi.mocked(commitCustomCapture)

function makeDb(rows: unknown[] = []) {
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'is', 'gte', 'order', 'limit']) {
    builder[m] = () => builder
  }
  builder.maybeSingle = async () => ({ data: rows[0] ?? null, error: null })
  builder.single = async () => ({ data: rows[0] ?? null, error: rows[0] ? null : { message: 'no row' } })
  ;(builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: rows, error: null })
  return { from: () => builder } as never
}

function bm(partial: Partial<Biomarker> & { id: string; name: string }): Biomarker {
  return {
    short_name: null,
    category: 'General',
    unit: 'ng/mL',
    description: null,
    ref_range_low: null,
    ref_range_high: null,
    ref_range_low_male: null,
    ref_range_high_male: null,
    ref_range_low_female: null,
    ref_range_high_female: null,
    aliases: [],
    parent_id: null,
    variant_name: null,
    panel_id: null,
    archived_at: null,
    created_at: '',
    ...partial,
  } as Biomarker
}

const opts = { toolCallId: 't', messages: [], context: {} }

describe('createHealthRecordTools', () => {
  it('exposes the full health-record CRUD tool set', () => {
    const tools = createHealthRecordTools(makeDb(), '11111111-1111-4111-8111-111111111111')
    expect(Object.keys(tools).sort()).toEqual([
      'add_blood_results',
      'attach_document_to_record',
      'create_blood_test',
      'delete_blood_test',
      'delete_body_log_entry',
      'delete_food_log',
      'delete_health_test',
      'get_blood_test',
      'get_health_test',
      'get_nutrition_targets',
      'list_blood_tests',
      'list_body_log',
      'list_food_logs',
      'list_health_tests',
      'log_body_entry',
      'log_food_entry',
      'remove_blood_results',
      'set_nutrition_targets',
      'update_blood_test',
      'update_food_log',
      'update_health_test',
    ])
  })

  it('create_blood_test refuses a same-date duplicate unless explicitly allowed', async () => {
    const existing = [{ id: 'bt-1', name: 'Blood test 2026-06-01', test_date: '2026-06-01' }]
    const tools = createHealthRecordTools(makeDb(existing), '11111111-1111-4111-8111-111111111111')
    const out = (await tools.create_blood_test.execute!(
      { test_date: '2026-06-01', markers: [{ name: 'Ferritin', value: 80 }] },
      opts
    )) as { error?: string; existing?: unknown[] }
    expect(out.error).toMatch(/already exists/i)
    expect(out.existing).toEqual(existing)
  })

  it('log_body_entry requires at least one metric', async () => {
    const tools = createHealthRecordTools(makeDb(), '11111111-1111-4111-8111-111111111111')
    const out = await tools.log_body_entry.execute!({ logged_on: '2026-06-01' }, opts)
    expect(out).toMatchObject({ error: expect.stringMatching(/at least one/i) })
  })

  it('update_health_test rejects numeric fields outside the per-type whitelist', async () => {
    const tools = createHealthRecordTools(makeDb(), '11111111-1111-4111-8111-111111111111')
    const out = await tools.update_health_test.execute!(
      { type: 'rmr', id: 'r1', values: { body_fat_pct: 20 } },
      opts
    )
    expect(out).toMatchObject({ error: expect.stringMatching(/not editable on rmr/i) })
  })

  it('update_health_test rejects metadata fields that do not apply to the type', async () => {
    const tools = createHealthRecordTools(makeDb(), '11111111-1111-4111-8111-111111111111')
    const out = await tools.update_health_test.execute!(
      { type: 'dexa', id: 'd1', name: 'My scan' },
      opts
    )
    expect(out).toMatchObject({ error: expect.stringMatching(/does not apply to dexa/i) })
  })

  it('update_food_log with no fields returns an error instead of touching the DB', async () => {
    const tools = createHealthRecordTools(makeDb(), '11111111-1111-4111-8111-111111111111')
    const out = await tools.update_food_log.execute!({ id: 'f1' }, opts)
    expect(out).toMatchObject({ error: expect.stringMatching(/no fields/i) })
  })

  it('update_blood_test reports not-found when the row does not exist (no-op write)', async () => {
    // makeDb() resolves the .update(...).select() chain to an empty array → 0 rows touched.
    const tools = createHealthRecordTools(makeDb(), '11111111-1111-4111-8111-111111111111')
    const out = await tools.update_blood_test.execute!({ testId: 'nope', name: 'X' }, opts)
    expect(out).toMatchObject({ error: expect.stringMatching(/not found/i) })
  })

  it('attach_document_to_record errors when the message has no attachment', async () => {
    const tools = createHealthRecordTools(makeDb(), '11111111-1111-4111-8111-111111111111', [])
    const out = await tools.attach_document_to_record.execute!(
      { recordType: 'blood', recordId: 'bt-1' },
      opts
    )
    expect(out).toMatchObject({ error: expect.stringMatching(/no file attached/i) })
  })

  it("attach_document_to_record refuses another user's file (authz guard)", async () => {
    const tools = createHealthRecordTools(makeDb(), '11111111-1111-4111-8111-111111111111', [
      { storagePath: '22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333331.pdf', mediaType: 'application/pdf', filename: 'full.pdf' },
    ])
    const out = await tools.attach_document_to_record.execute!(
      { recordType: 'blood', recordId: 'bt-1' },
      opts
    )
    expect(out).toMatchObject({ error: expect.stringMatching(/not authorized/i) })
  })

  it('attach_document_to_record links the upload and reports whether it replaced a previous file', async () => {
    const tools = createHealthRecordTools(
      makeDb([{ id: 'bt-1', pdf_storage_path: '11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333332.pdf' }]),
      '11111111-1111-4111-8111-111111111111',
      [{ storagePath: '11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333331.pdf', mediaType: 'application/pdf', filename: 'full.pdf' }]
    )
    const out = await tools.attach_document_to_record.execute!(
      { recordType: 'blood', recordId: 'bt-1' },
      opts
    )
    expect(out).toEqual({
      linked: 'full.pdf',
      recordId: 'bt-1',
      replacedPreviousDocument: true,
    })
  })
})

describe('resolveMarkerInputs', () => {
  const catalog = [
    bm({ id: 'b-ferritin', name: 'Ferritin', unit: 'ng/mL' }),
    bm({ id: 'b-hba1c', name: 'Hemoglobin A1c', short_name: 'HbA1c', unit: '%' }),
    bm({ id: 'b-vitd', name: '25-OH Vitamin D', aliases: ['Vitamin D'], unit: 'ng/mL' }),
  ]

  it('matches by catalog name case-insensitively', () => {
    const { resolved, unmatched } = resolveMarkerInputs(
      [{ name: 'ferritin', value: 80, unit: 'ng/mL' }],
      catalog
    )
    expect(unmatched).toEqual([])
    expect(resolved).toEqual([
      { biomarker_id: 'b-ferritin', name: 'Ferritin', value: 80, unit: 'ng/mL' },
    ])
  })

  it('matches by short name and alias', () => {
    const { resolved, unmatched } = resolveMarkerInputs(
      [
        { name: 'HbA1c', value: 5.2, unit: '%' },
        { name: 'vitamin d', value: 42 },
      ],
      catalog
    )
    expect(unmatched).toEqual([])
    expect(resolved.map((m) => m.biomarker_id)).toEqual(['b-hba1c', 'b-vitd'])
  })

  it('falls back to the catalog unit when no unit is given', () => {
    const { resolved } = resolveMarkerInputs([{ name: 'Ferritin', value: 80 }], catalog)
    expect(resolved[0].unit).toBe('ng/mL')
  })

  it('reports unmatched names without dropping the matched ones', () => {
    const { resolved, unmatched } = resolveMarkerInputs(
      [
        { name: 'Ferritin', value: 80 },
        { name: 'Totally Unknown Marker', value: 1 },
      ],
      catalog
    )
    expect(resolved).toHaveLength(1)
    expect(unmatched).toEqual(['Totally Unknown Marker'])
  })

  it('keeps the LAST value when the same marker appears twice (correction wins)', () => {
    const { resolved } = resolveMarkerInputs(
      [
        { name: 'HbA1c', value: 5.6, unit: '%' },
        { name: 'Hemoglobin A1c', value: 5.2, unit: '%' },
      ],
      catalog
    )
    expect(resolved).toEqual([
      { biomarker_id: 'b-hba1c', name: 'Hemoglobin A1c', value: 5.2, unit: '%' },
    ])
  })
})

describe('resolveMarkerInputsViaLoinc', () => {
  const catalog = [bm({ id: 'b-fer', name: 'Ferritin', unit: 'ng/mL' })]

  beforeEach(() => {
    mockResolveMarker.mockReset()
    mockCommitCapture.mockReset()
    mockCommitCustomCapture.mockReset()
  })

  it('matches existing, CAPTURES a new LOINC marker, and CUSTOM-captures the rest', async () => {
    mockResolveMarker.mockImplementation(async (marker) => {
      if (/ferritin/i.test(marker.name)) return { status: 'matched', biomarkerId: 'b-fer', via: 'existing' }
      if (/transferrin/i.test(marker.name))
        return { status: 'capturable', loincCode: '30248-9', cleanName: 'Soluble Transferrin Receptor' }
      return { status: 'unresolved', name: marker.name }
    })
    mockCommitCapture.mockResolvedValue('b-captured')
    mockCommitCustomCapture.mockResolvedValue('b-custom')

    const { resolved, unmatched, custom } = await resolveMarkerInputsViaLoinc(
      [
        { name: 'ferritin', value: 80, unit: 'ng/mL' },
        { name: 'soluble transferrin receptor', value: 1.2, unit: 'mg/L' },
        { name: 'AA/EPA', value: 16.38, unit: 'ratio' },
      ],
      catalog,
      makeDb()
    )

    // Nothing is dropped: the out-of-catalog non-LOINC marker becomes custom.
    expect(unmatched).toEqual([])
    expect(custom).toEqual(['AA/EPA'])
    expect(resolved).toEqual([
      { biomarker_id: 'b-fer', name: 'Ferritin', value: 80, unit: 'ng/mL' },
      { biomarker_id: 'b-captured', name: 'Soluble Transferrin Receptor', value: 1.2, unit: 'mg/L' },
      { biomarker_id: 'b-custom', name: 'AA/EPA', value: 16.38, unit: 'ratio' },
    ])
    // LOINC capture for the transferrin marker…
    expect(mockCommitCapture).toHaveBeenCalledTimes(1)
    expect(mockCommitCapture).toHaveBeenCalledWith(
      '30248-9',
      { name: 'soluble transferrin receptor', unit: 'mg/L' },
      expect.objectContaining({ db: expect.anything() })
    )
    // …and custom capture for the unresolved ratio.
    expect(mockCommitCustomCapture).toHaveBeenCalledTimes(1)
    expect(mockCommitCustomCapture).toHaveBeenCalledWith(
      { name: 'AA/EPA', unit: 'ratio' },
      expect.objectContaining({ db: expect.anything() })
    )
  })

  it('still reports a hard failure (custom capture throws) in unmatched, not custom', async () => {
    mockResolveMarker.mockResolvedValue({ status: 'unresolved', name: 'boom' })
    mockCommitCustomCapture.mockRejectedValue(new Error('db down'))

    const { resolved, unmatched, custom } = await resolveMarkerInputsViaLoinc(
      [{ name: 'boom', value: 1, unit: 'ratio' }],
      catalog,
      makeDb()
    )

    expect(resolved).toEqual([])
    expect(custom).toEqual([])
    expect(unmatched).toEqual(['boom'])
  })

  it('forwards a model-supplied loinc_code to the resolver (AI-code path)', async () => {
    mockResolveMarker.mockResolvedValue({ status: 'capturable', loincCode: '2692-2', cleanName: 'Serum Osmolality' })
    mockCommitCapture.mockResolvedValue('b-osmo')

    const { resolved } = await resolveMarkerInputsViaLoinc(
      [{ name: 'Osmolality (serum)', value: 284, unit: 'mosm/kg', loinc_code: '2692-2' }],
      catalog,
      makeDb()
    )

    expect(mockResolveMarker).toHaveBeenCalledWith(
      { name: 'Osmolality (serum)', unit: 'mosm/kg', loinc_code: '2692-2' },
      catalog,
      expect.objectContaining({ db: expect.anything() })
    )
    expect(resolved).toEqual([
      { biomarker_id: 'b-osmo', name: 'Serum Osmolality', value: 284, unit: 'mosm/kg' },
    ])
  })

  it('passes loinc_code as null when the model omits it (name/NLM path unchanged)', async () => {
    mockResolveMarker.mockResolvedValue({ status: 'matched', biomarkerId: 'b-fer', via: 'existing' })

    await resolveMarkerInputsViaLoinc([{ name: 'ferritin', value: 80, unit: 'ng/mL' }], catalog, makeDb())

    expect(mockResolveMarker).toHaveBeenCalledWith(
      { name: 'ferritin', unit: 'ng/mL', loinc_code: null },
      catalog,
      expect.objectContaining({ db: expect.anything() })
    )
  })

  it('isolates a failing marker (resolve throws) without dropping the rest', async () => {
    mockResolveMarker.mockImplementation(async (marker) => {
      if (/ferritin/i.test(marker.name)) return { status: 'matched', biomarkerId: 'b-fer', via: 'existing' }
      throw new Error('db boom')
    })

    const { resolved, unmatched } = await resolveMarkerInputsViaLoinc(
      [
        { name: 'ferritin', value: 80 },
        { name: 'boom marker', value: 5 },
      ],
      catalog,
      makeDb()
    )

    expect(resolved.map((r) => r.biomarker_id)).toEqual(['b-fer'])
    expect(unmatched).toEqual(['boom marker'])
  })
})
