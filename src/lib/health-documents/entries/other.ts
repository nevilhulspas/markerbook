import { saveOtherTest } from '@/actions/other-import'
import { parseOtherBytes } from '@/lib/other/parse'
import { OTHER_OUTCOME_LABELS } from '@/lib/other/display'
import type { OtherExtraction } from '@/lib/validations/other-import'
import type { HealthDocumentType } from '@/lib/health-documents/types'

export const otherDocumentType: HealthDocumentType<OtherExtraction> = {
  id: 'other',
  label: 'other test',
  // Registered LAST so it acts as a fallback: only matches a lab/health test
  // that is NOT one of the specific types above.
  classifierHint:
    "any OTHER lab/health test not covered by the types above — e.g. a SIBO breath test, food-intolerance / IgG panel, organic acids test (OAT), saliva cortisol, heavy-metals screen, or stool pathogen / infection screen. Usually a simple positive/negative or normal/abnormal outcome plus a few readings. Use this ONLY when the document is a real test result that doesn't fit blood, DUTCH, microbiome, DEXA or RMR.",
  accepts: ['pdf', 'image'],
  parse: (bytes, mediaType) => parseOtherBytes(bytes, mediaType),
  summarize: (e) => ({
    title: e.test.test_name || 'Other test',
    dateLabel: e.test.test_date,
    lines: [
      `Result: ${OTHER_OUTCOME_LABELS[e.test.outcome]}`,
      e.test.result_summary ?? '',
      e.values.length > 0 ? `${e.values.length} reading${e.values.length > 1 ? 's' : ''}` : '',
    ].filter(Boolean),
  }),
  persist: async (extraction, storagePath) => {
    const res = await saveOtherTest({
      extraction,
      storagePath: storagePath ?? undefined,
      source: 'summary',
    })
    if (!res.success) throw new Error(res.error)
    return { recordId: res.testId, href: `/other/${res.testId}` }
  },
}
