import { z } from 'zod'

import { RESULT_QUALIFIERS } from '@/lib/blood-tests/qualifier'

/**
 * Schema for a single marker entry in the blood test save payload.
 *
 * Exactly ONE of `biomarker_id` / `capture_loinc_code` / `capture_custom`:
 *   - `biomarker_id`       — the marker already has a catalog biomarker
 *   - `capture_loinc_code` — resolved to a new LOINC code; `createBloodTest`
 *                            calls `commitCapture` first to create the row
 *   - `capture_custom`     — no catalog/LOINC match; `createBloodTest` calls
 *                            `commitCustomCapture` to create a custom biomarker
 *                            keyed on `name`
 *
 * `ref_range_low`/`ref_range_high` are forwarded from the extraction so the
 * commit fns can prefer the printed report range over an AI estimate. `name` is
 * the lab's raw marker spelling — required for custom entries (it's the catalog
 * name) and forwarded for capturable entries as a match alias.
 */
export const markerEntrySchema = z
  .object({
    biomarker_id: z.string().uuid().optional(),
    capture_loinc_code: z.string().optional(),
    capture_custom: z.literal(true).optional(),
    name: z.string().optional(),
    // Negative results are real (base excess, z-scores), so any finite number.
    value: z.number({ message: 'Value is required' }),
    /** '<' / '>' etc. when the lab reported "<0.5" or ">100"; null for a plain value. */
    qualifier: z.enum(RESULT_QUALIFIERS).nullable().optional(),
    unit: z.string().min(1, 'Unit is required'),
    ref_range_low: z.number().nullable().optional(),
    ref_range_high: z.number().nullable().optional(),
  })
  .refine(
    (m) =>
      [m.biomarker_id, m.capture_loinc_code, m.capture_custom].filter(Boolean).length === 1,
    { message: 'Provide exactly one of biomarker_id, capture_loinc_code or capture_custom' },
  )
  .refine((m) => !m.capture_custom || (m.name?.trim().length ?? 0) > 0, {
    message: 'A custom marker requires a name',
  })

export const bloodTestSchema = z.object({
  name: z
    .string()
    .min(1, 'Test name is required')
    .max(200, 'Test name must be at most 200 characters'),
  test_date: z.string().date('Please enter a valid date'),
  sample_type: z.enum(['serum', 'plasma', 'unknown']),
  notes: z.string().max(1000, 'Notes must be at most 1000 characters').optional(),
  pdf_storage_path: z.string().optional(),
  markers: z
    .array(markerEntrySchema)
    .min(1, 'Add at least one marker'),
})

export type BloodTestFormValues = z.infer<typeof bloodTestSchema>
export type MarkerEntryValues = z.infer<typeof markerEntrySchema>
