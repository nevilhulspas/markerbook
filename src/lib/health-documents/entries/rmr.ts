import { saveRmrTest } from '@/actions/rmr-import'
import { parseRmrBytes } from '@/lib/rmr/parse'
import type { RmrExtraction } from '@/lib/validations/rmr-import'
import type { HealthDocumentType } from '@/lib/health-documents/types'

export const rmrDocumentType: HealthDocumentType<RmrExtraction> = {
  id: 'rmr',
  label: 'RMR test',
  classifierHint:
    'a resting metabolic rate (RMR) / indirect-calorimetry report: RMR in kcal/day (measured vs predicted), respiratory exchange ratio (RER) and a carb-vs-fat fuel mix, often a TDEE table by activity level (e.g. DexaFit).',
  accepts: ['pdf', 'image'],
  parse: (bytes, mediaType) => parseRmrBytes(bytes, mediaType),
  summarize: (e) => ({
    title: 'RMR test',
    dateLabel: e.test.test_date,
    lines: [
      `RMR: ${e.test.rmr_kcal} kcal/day`,
      e.test.fuel_carb_pct != null
        ? `Fuel: ${e.test.fuel_carb_pct}% carbs / ${e.test.fuel_fat_pct ?? '—'}% fat`
        : e.test.rer != null
          ? `RER: ${e.test.rer}`
          : '',
    ].filter(Boolean),
  }),
  persist: async (extraction, storagePath) => {
    const res = await saveRmrTest({
      extraction,
      storagePath: storagePath ?? undefined,
      source: 'summary',
    })
    if (!res.success) throw new Error(res.error)
    return { recordId: res.testId, href: `/body/rmr/${res.testId}` }
  },
}
