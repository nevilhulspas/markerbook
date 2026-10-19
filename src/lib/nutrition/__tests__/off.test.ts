import { vi } from 'vitest'

// Mock global fetch before any imports that might use it
const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }))
vi.stubGlobal('fetch', mockFetch)

import { describe, it, expect, beforeEach } from 'vitest'
import { searchOff } from '../off'

function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

const HAPPY_PRODUCT = {
  code: '8712345678901',
  product_name: 'Hagelslag',
  brands: 'De Ruijter',
  nutriments: {
    'energy-kcal_100g': 460,
    'proteins_100g': 5.2,
    'carbohydrates_100g': 77,
    'fat_100g': 14,
    'fiber_100g': 3.1,
    'sugars_100g': 55,
    'saturated-fat_100g': 8.5,
    'sodium_100g': 0.25, // grams → should become 250 mg
  },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('searchOff', () => {
  it('maps a happy-path product including brand suffix and sodium g→mg conversion', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ products: [HAPPY_PRODUCT] }))

    const results = await searchOff('hagelslag')

    expect(results).toHaveLength(1)
    const r = results[0]
    expect(r.barcode).toBe('8712345678901')
    expect(r.name).toBe('Hagelslag — De Ruijter')
    expect(r.per100g.kcal).toBe(460)
    expect(r.per100g.protein).toBe(5.2)
    expect(r.per100g.carbs).toBe(77)
    expect(r.per100g.fat).toBe(14)
    expect(r.per100g.fiber).toBe(3.1)
    expect(r.per100g.sugar).toBe(55)
    expect(r.per100g.sat_fat).toBe(8.5)
    // sodium: 0.25 g × 1000 = 250 mg
    expect(r.per100g.sodium_mg).toBe(250)
  })

  it('omits brand suffix when brands is absent', async () => {
    const product = { ...HAPPY_PRODUCT, brands: undefined }
    mockFetch.mockResolvedValueOnce(makeResponse({ products: [product] }))

    const results = await searchOff('hagelslag')
    expect(results[0].name).toBe('Hagelslag')
  })

  it('filters out products with no product_name', async () => {
    const noName = { ...HAPPY_PRODUCT, product_name: '' }
    mockFetch.mockResolvedValueOnce(makeResponse({ products: [noName] }))

    const results = await searchOff('hagelslag')
    expect(results).toHaveLength(0)
  })

  it('filters out products with zero kcal', async () => {
    const zeroKcal = {
      ...HAPPY_PRODUCT,
      nutriments: { ...HAPPY_PRODUCT.nutriments, 'energy-kcal_100g': 0 },
    }
    mockFetch.mockResolvedValueOnce(makeResponse({ products: [zeroKcal] }))

    const results = await searchOff('hagelslag')
    expect(results).toHaveLength(0)
  })

  it('returns [] and logs error on non-200 response', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockResolvedValueOnce(makeResponse({}, 500))

    const results = await searchOff('anything')
    expect(results).toHaveLength(0)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('returns [] and logs error on network failure', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const results = await searchOff('anything')
    expect(results).toHaveLength(0)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('returns [] and logs error on bad JSON', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('bad json')
      },
    } as unknown as Response)

    const results = await searchOff('anything')
    expect(results).toHaveLength(0)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('defaults missing nutriments fields to 0', async () => {
    const sparse = {
      code: '111',
      product_name: 'Mystery Food',
      nutriments: { 'energy-kcal_100g': 100 },
    }
    mockFetch.mockResolvedValueOnce(makeResponse({ products: [sparse] }))

    const results = await searchOff('mystery')
    expect(results).toHaveLength(1)
    expect(results[0].per100g.protein).toBe(0)
    expect(results[0].per100g.sodium_mg).toBe(0)
  })

  it('passes the correct URL parameters', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ products: [] }))

    await searchOff('appeltaart', 3)

    const callUrl = mockFetch.mock.calls[0][0] as string
    expect(callUrl).toContain('nl.openfoodfacts.org')
    expect(callUrl).toContain('search_terms=appeltaart')
    expect(callUrl).toContain('page_size=3')
    expect(callUrl).toContain('json=1')
  })
})
