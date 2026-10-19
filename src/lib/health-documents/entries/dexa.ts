import { saveDexaScan } from '@/actions/dexa-import'
import { parseDexaBytes } from '@/lib/dexa/parse'
import type { DexaExtraction } from '@/lib/validations/dexa-import'
import type { HealthDocumentType } from '@/lib/health-documents/types'

export const dexaDocumentType: HealthDocumentType<DexaExtraction> = {
  id: 'dexa',
  label: 'DEXA body scan',
  classifierHint:
    'a DEXA / DXA body-composition scan with body-fat %, lean & fat mass by region, visceral fat, FFMI/ALMI, and bone density (T-score).',
  accepts: ['pdf', 'image'],
  parse: (bytes, mediaType, ctx) => parseDexaBytes(bytes, mediaType, ctx.userId, ctx.db),
  summarize: (e) => ({
    title: 'DEXA body scan',
    dateLabel: e.scan.scan_date,
    lines: [
      e.scan.body_fat_pct != null ? `Body fat: ${e.scan.body_fat_pct}%` : `${e.regions.length} regions`,
      e.scan.bone_t_score != null ? `T-score: ${e.scan.bone_t_score}` : `Total mass: ${e.scan.total_mass_kg ?? '—'} kg`,
    ],
  }),
  persist: async (extraction, storagePath) => {
    const res = await saveDexaScan({ extraction, storagePath: storagePath ?? undefined, source: 'summary' })
    if (!res.success) throw new Error(res.error)
    return { recordId: res.scanId, href: `/body/${res.scanId}` }
  },
}
