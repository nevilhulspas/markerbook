import { describe, it, expect, vi } from 'vitest'

import {
  cleanCatalogText,
  loincUnitToLabUnit,
  rememberCreatorUnit,
  MAX_CATALOG_NAME_LENGTH,
} from '../shared-catalog'

describe('cleanCatalogText', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanCatalogText('  Vitamin   D \n 25-OH ')).toBe('Vitamin D 25-OH')
  })

  it('removes control and bidi/zero-width characters', () => {
    expect(cleanCatalogText('Ferr\u0000itin‮​')).toBe('Ferr itin')
  })

  it('cuts to the maximum length on a character boundary', () => {
    const out = cleanCatalogText('é'.repeat(500))!
    expect(Array.from(out)).toHaveLength(MAX_CATALOG_NAME_LENGTH)
    expect(cleanCatalogText('abcdef', 3)).toBe('abc')
  })

  it('returns null when nothing is left', () => {
    expect(cleanCatalogText('  \u0000 ')).toBeNull()
    expect(cleanCatalogText(null)).toBeNull()
  })
})

describe('loincUnitToLabUnit', () => {
  it('maps UCUM spelling to lab spelling', () => {
    expect(loincUnitToLabUnit('10*3/uL')).toBe('10^3/uL')
    expect(loincUnitToLabUnit('[IU]/L')).toBe('IU/L')
    expect(loincUnitToLabUnit('mg/dL')).toBe('mg/dL')
  })

  it('drops annotations and returns null when no unit is left', () => {
    expect(loincUnitToLabUnit('{ratio}')).toBeNull()
    expect(loincUnitToLabUnit('')).toBeNull()
    expect(loincUnitToLabUnit(null)).toBeNull()
  })

  it('takes the first of several example units', () => {
    expect(loincUnitToLabUnit('mmol/L;mg/dL')).toBe('mmol/L')
  })
})

describe('rememberCreatorUnit', () => {
  function stubDb() {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const db = { from: vi.fn(() => ({ upsert })) }
    return { db: db as never, upsert }
  }

  it("saves the creator's unit without replacing an existing preference", async () => {
    const { db, upsert } = stubDb()
    await rememberCreatorUnit(db, 'u1', 'bm-1', 'mg/l', '')
    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'u1', biomarker_id: 'bm-1', preferred_unit: 'mg/l' },
      { onConflict: 'user_id,biomarker_id', ignoreDuplicates: true }
    )
  })

  it('does nothing without a user, without a unit, or when it is the catalogue unit', async () => {
    const { db, upsert } = stubDb()
    await rememberCreatorUnit(db, null, 'bm-1', 'mg/l', '')
    await rememberCreatorUnit(db, 'u1', 'bm-1', '  ', '')
    await rememberCreatorUnit(db, 'u1', 'bm-1', 'µg/L', 'ng/mL')
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('creatorFields', () => {
  /** A client whose `select('created_by')` fails until `hasColumn` flips. */
  function db(state: { hasColumn: boolean; checks: number }) {
    return {
      from: () => ({
        select: () => ({
          limit: async () => {
            state.checks++
            return { error: state.hasColumn ? null : { message: "column biomarkers.created_by does not exist" } }
          },
        }),
      }),
    } as never
  }

  it('leaves created_by out while the column is missing, and picks it up once added', async () => {
    const { creatorFields } = await import('../shared-catalog')
    const state = { hasColumn: false, checks: 0 }
    expect(await creatorFields(db(state), 'user-1')).toEqual({})
    state.hasColumn = true
    expect(await creatorFields(db(state), 'user-1')).toEqual({ created_by: 'user-1' })
    // Once seen, the column is not checked again.
    expect(await creatorFields(db(state), 'user-1')).toEqual({ created_by: 'user-1' })
    expect(state.checks).toBe(2)
  })

  it('adds nothing without a user', async () => {
    const { creatorFields } = await import('../shared-catalog')
    expect(await creatorFields(db({ hasColumn: true, checks: 0 }), null)).toEqual({})
  })
})
