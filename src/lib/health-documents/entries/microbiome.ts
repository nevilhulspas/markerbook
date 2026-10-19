import { saveMicrobiomeReport } from '@/actions/microbiome-import'
import { parseMicrobiomeBytes } from '@/lib/microbiome/parse'
import type { MicrobiomeExtraction } from '@/lib/validations/microbiome-import'
import type { HealthDocumentType } from '@/lib/health-documents/types'

export const microbiomeDocumentType: HealthDocumentType<MicrobiomeExtraction> = {
  id: 'microbiome',
  label: 'microbiome report',
  classifierHint:
    'a gut microbiome / stool test listing bacterial taxa (phyla, genera, species) with abundances and diversity/health scores.',
  accepts: ['pdf', 'image'],
  parse: (bytes, mediaType) => parseMicrobiomeBytes(bytes, mediaType),
  summarize: (e) => ({
    title: 'Microbiome report',
    dateLabel: e.test.test_date,
    lines: [
      `${e.results.length} taxa`,
      `${e.scores.length} scores`,
      e.test.lab_name ? `Lab: ${e.test.lab_name}` : `Sample: ${e.test.sample_type ?? 'stool'}`,
    ],
  }),
  persist: async (extraction, storagePath) => {
    const res = await saveMicrobiomeReport({ extraction, storagePath: storagePath ?? undefined })
    if (!res.success) throw new Error(res.error)
    return { recordId: res.testId, href: `/microbiome/${res.testId}` }
  },
}
