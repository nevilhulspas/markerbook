import { describe, it, expect, vi } from 'vitest'

// parse.ts imports the AI extraction helper; it is never called here.
vi.mock('@/lib/ai/extract-document', () => ({ extractDocumentJson: vi.fn() }))

import { applyProfileFallback } from '../parse'
import { dexaScanSchema, type DexaExtraction } from '@/lib/validations/dexa-import'

function scan(over: Record<string, unknown>): DexaExtraction {
  return { scan: dexaScanSchema.parse({ scan_date: '2026-05-01', ...over }), regions: [] }
}

describe('DEXA FFMI after the profile height fallback (regression)', () => {
  it('derives FFMI from the profile height when the report has none', () => {
    const data = applyProfileFallback(scan({ lean_mass_g: 60000, bmc_g: 3000 }), {
      date_of_birth: null,
      height_cm: 180,
    })
    expect(data.scan.height_cm).toBe(180)
    expect(data.scan.ffmi).toBeCloseTo(63 / (1.8 * 1.8), 3)
  })

  it('keeps a printed FFMI', () => {
    const data = applyProfileFallback(scan({ lean_mass_g: 60000, ffmi: 19.1 }), {
      date_of_birth: null,
      height_cm: 180,
    })
    expect(data.scan.ffmi).toBe(19.1)
  })
})
