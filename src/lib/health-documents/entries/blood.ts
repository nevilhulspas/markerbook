import { createBloodTest } from '@/actions/blood-tests'
import { parseBloodBytes, type BloodParseResult } from '@/lib/extraction/parse'
import { bloodExtractionToValues } from '@/lib/health-documents/mappers'
import type { HealthDocumentType } from '@/lib/health-documents/types'
import { appTodayISO } from '@/lib/dates/today'

export const bloodDocumentType: HealthDocumentType<BloodParseResult> = {
  id: 'blood',
  label: 'blood test',
  classifierHint:
    'a blood/serum lab report listing biomarkers with values, units and reference ranges (e.g. ferritin, TSH, cholesterol).',
  accepts: ['pdf', 'image'],
  parse: (bytes, mediaType, ctx) => parseBloodBytes(bytes, mediaType, ctx.db),
  summarize: ({ result, matchedMarkers }) => ({
    title: 'Blood test',
    dateLabel: result.test_date,
    lines: [
      // Count matched + capturable: both will be saved (capturable markers are
      // written via commitCapture at save time).
      `${matchedMarkers.filter((m) => m.matched || m.capture_loinc_code).length} of ${matchedMarkers.length} markers matched`,
      result.lab_name ? `Lab: ${result.lab_name}` : `Sample: ${result.sample_type}`,
    ],
  }),
  persist: async ({ result, matchedMarkers }, storagePath) => {
    const today = appTodayISO()
    const values = bloodExtractionToValues(result, matchedMarkers, storagePath, today)
    const res = await createBloodTest(values)
    if (!res.success) throw new Error(res.error)
    return { recordId: res.testId, href: `/tests/${res.testId}` }
  },
}
