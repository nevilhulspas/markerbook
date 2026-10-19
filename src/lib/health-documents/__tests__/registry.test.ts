import { describe, it, expect, vi } from 'vitest'

// Registry entries transitively import server-only server actions. Stub the
// guard and the modules that construct real clients at import time so loading
// the registry does not require live Supabase env vars.
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: {} }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import {
  HEALTH_DOCUMENT_TYPES,
  getHealthDocumentType,
  buildClassifierGuidance,
} from '../registry'

describe('health-document registry', () => {
  it('every registered entry has a unique id', () => {
    const ids = HEALTH_DOCUMENT_TYPES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('getHealthDocumentType returns undefined for an unknown id', () => {
    expect(getHealthDocumentType('nope')).toBeUndefined()
  })
  it('getHealthDocumentType resolves a registered id when present', () => {
    for (const t of HEALTH_DOCUMENT_TYPES) {
      expect(getHealthDocumentType(t.id)?.id).toBe(t.id)
    }
  })
  it('classifier guidance includes the header and a line per registered type', () => {
    const text = buildClassifierGuidance()
    expect(text).toContain('# Uploaded health documents')
    for (const t of HEALTH_DOCUMENT_TYPES) {
      expect(text).toContain(t.id)
      expect(text).toContain(t.label)
    }
  })
  it('registers exactly the expected types', () => {
    expect(HEALTH_DOCUMENT_TYPES.map((t) => t.id).sort()).toEqual([
      'blood', 'dexa', 'dutch', 'microbiome', 'other', 'rmr',
    ])
  })

  it('resolves the rmr health-document type', () => {
    const rmr = getHealthDocumentType('rmr')
    expect(rmr).toBeDefined()
    expect(rmr?.id).toBe('rmr')
    expect(rmr?.label).toBe('RMR test')
  })

  it('resolves the generic "other" health-document type', () => {
    const other = getHealthDocumentType('other')
    expect(other).toBeDefined()
    expect(other?.id).toBe('other')
  })

  it('keeps "other" registered last so it acts as a fallback', () => {
    const ids = HEALTH_DOCUMENT_TYPES.map((t) => t.id)
    expect(ids[ids.length - 1]).toBe('other')
  })
})
