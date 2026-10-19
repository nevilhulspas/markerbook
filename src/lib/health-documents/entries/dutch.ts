import { createDutchTest } from '@/actions/dutch-tests'
import { parseDutchBytes, type DutchParseResult } from '@/lib/dutch/parse'
import { dutchExtractionToValues } from '@/lib/health-documents/mappers'
import type { HealthDocumentType } from '@/lib/health-documents/types'

export const dutchDocumentType: HealthDocumentType<DutchParseResult> = {
  id: 'dutch',
  label: 'DUTCH hormone test',
  classifierHint:
    'a DUTCH (Dried Urine Test for Comprehensive Hormones) report with sex/adrenal hormones and metabolites across timepoints (waking, morning, etc.).',
  accepts: ['pdf', 'image'],
  parse: (bytes, mediaType, ctx) => parseDutchBytes(bytes, mediaType, ctx.db),
  summarize: ({ result, matchedMarkers }) => ({
    title: 'DUTCH hormone test',
    dateLabel: result.test_date,
    lines: [
      `${matchedMarkers.filter((m) => m.matched).length} of ${matchedMarkers.length} markers matched`,
      `Sex: ${result.patient_sex}`,
    ],
  }),
  persist: async ({ result, matchedMarkers }, storagePath) => {
    const values = dutchExtractionToValues(result, matchedMarkers, storagePath)
    const res = await createDutchTest(values)
    if (!res.success) throw new Error(res.error)
    return { recordId: res.testId, href: `/dutch/${res.testId}` }
  },
}
