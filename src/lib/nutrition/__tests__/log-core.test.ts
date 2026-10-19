import { vi } from 'vitest'

// Hoist mocks before imports
const { mockMatchItem } = vi.hoisted(() => ({
  mockMatchItem: vi.fn(),
}))

vi.mock('../match', async (orig) => {
  const actual = (await orig()) as object
  return { ...actual, matchItem: mockMatchItem }
})

import { describe, it, expect, beforeEach } from 'vitest'
import { logSubmission, resolveEntryDate, type LogDeps, type FoodLogInsertRow } from '../log-core'
import type { ExtractionV2 } from '../types'
import type { Macros100, MatchedItem } from '../match'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function zeroMacros(): Macros100 {
  return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium_mg: 0, sat_fat: 0 }
}

function makeMatchedItem(name: string, grams: number, macros: Partial<Macros100> = {}): MatchedItem {
  return {
    source: 'estimate',
    ref: null,
    recipeId: null,
    customFoodId: null,
    name,
    grams,
    macros: { ...zeroMacros(), ...macros },
  }
}

function makeExtraction(overrides: Partial<ExtractionV2> = {}): ExtractionV2 {
  return {
    items: [
      {
        query: 'test food',
        grams: 100,
        estimated_calories: 100,
        estimated_protein_g: 10,
        estimated_carbs_g: 10,
        estimated_fat_g: 5,
        estimated_fiber_g: 1,
        estimated_sugar_g: 2,
        estimated_sodium_mg: 50,
        estimated_saturated_fat_g: 1,
      },
    ],
    food_name: 'Test food',
    notes: null,
    date_offset_days: null,
    meal_time: null,
    question: null,
    ...overrides,
  }
}

function makeDeps(
  parse: (text: string, opts: { libraryNames: string[]; assumeDefaults: boolean }) => Promise<ExtractionV2>,
  insertRows: (rows: FoodLogInsertRow[]) => Promise<{ error: string | null }>,
  overrides: Partial<LogDeps> = {}
): LogDeps {
  return {
    library: [],
    searchNevo: async () => [],
    searchOff: async () => [],
    rerank: async () => null,
    parse,
    insertRows,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('logSubmission', () => {
  it('returns question outcome when question present and assumeDefaults=false', async () => {
    const extraction = makeExtraction({ question: 'Is the 200g just the chicken?' })
    const deps = makeDeps(
      async () => extraction,
      async () => ({ error: null })
    )

    const outcome = await logSubmission(deps, {
      userId: 'u1',
      text: '200g chicken with rice',
      source: 'app',
      mealOverride: null,
      dateOverride: null,
      assumeDefaults: false,
    })

    expect(outcome.kind).toBe('question')
    if (outcome.kind === 'question') {
      expect(outcome.question).toBe('Is the 200g just the chicken?')
    }
    // insert should NOT have been called
    expect(mockMatchItem).not.toHaveBeenCalled()
  })

  it('proceeds when question present but assumeDefaults=true', async () => {
    const extraction = makeExtraction({ question: 'Some question?' })
    mockMatchItem.mockResolvedValue(makeMatchedItem('Test food', 100, { kcal: 100 }))

    const insertedRows: FoodLogInsertRow[] = []
    const deps = makeDeps(
      async () => extraction,
      async (rows) => {
        insertedRows.push(...rows)
        return { error: null }
      }
    )

    const outcome = await logSubmission(deps, {
      userId: 'u1',
      text: '200g chicken with rice',
      source: 'app',
      mealOverride: null,
      dateOverride: null,
      assumeDefaults: true,
    })

    expect(outcome.kind).toBe('logged')
    expect(insertedRows.length).toBe(1)
  })

  it('3-item fan-out shares submission_id and raw_input, totals sum correctly', async () => {
    const extraction = makeExtraction({
      items: [
        {
          query: 'big mac',
          grams: 200,
          estimated_calories: 550,
          estimated_protein_g: 27,
          estimated_carbs_g: 45,
          estimated_fat_g: 30,
          estimated_fiber_g: 3,
          estimated_sugar_g: 9,
          estimated_sodium_mg: 1010,
          estimated_saturated_fat_g: 10,
        },
        {
          query: 'french fries',
          grams: 150,
          estimated_calories: 400,
          estimated_protein_g: 4,
          estimated_carbs_g: 52,
          estimated_fat_g: 20,
          estimated_fiber_g: 4,
          estimated_sugar_g: 0,
          estimated_sodium_mg: 400,
          estimated_saturated_fat_g: 3,
        },
        {
          query: 'filet o fish',
          grams: 141,
          estimated_calories: 380,
          estimated_protein_g: 15,
          estimated_carbs_g: 38,
          estimated_fat_g: 18,
          estimated_fiber_g: 1,
          estimated_sugar_g: 5,
          estimated_sodium_mg: 640,
          estimated_saturated_fat_g: 4,
        },
      ],
      food_name: '2x Big Mac, French Fries, Filet-O-Fish',
      meal_time: 'lunch',
      question: null,
    })

    mockMatchItem
      .mockResolvedValueOnce(makeMatchedItem('Big Mac', 200, { kcal: 550, protein: 27 }))
      .mockResolvedValueOnce(makeMatchedItem('French Fries', 150, { kcal: 400, protein: 4 }))
      .mockResolvedValueOnce(makeMatchedItem('Filet-O-Fish', 141, { kcal: 380, protein: 15 }))

    const capturedRows: FoodLogInsertRow[] = []
    const deps = makeDeps(
      async () => extraction,
      async (rows) => {
        capturedRows.push(...rows)
        return { error: null }
      }
    )

    const outcome = await logSubmission(deps, {
      userId: 'u1',
      text: '2x big mac, french fries and one filet o fish',
      source: 'shortcut',
      mealOverride: null,
      dateOverride: null,
      assumeDefaults: true,
    })

    expect(outcome.kind).toBe('logged')
    if (outcome.kind !== 'logged') return

    // All 3 rows share one submission_id
    expect(capturedRows).toHaveLength(3)
    const submissionIds = new Set(capturedRows.map((r) => r.submission_id))
    expect(submissionIds.size).toBe(1)

    // All rows share raw_input
    const rawInputs = new Set(capturedRows.map((r) => r.raw_input))
    expect(rawInputs.size).toBe(1)
    expect(rawInputs.has('2x big mac, french fries and one filet o fish')).toBe(true)

    // Totals sum correctly
    expect(outcome.totals.kcal).toBeCloseTo(550 + 400 + 380)
    expect(outcome.totals.protein).toBeCloseTo(27 + 4 + 15)

    // Items summary
    expect(outcome.items).toHaveLength(3)
  })

  it('mealOverride beats parsed.meal_time beats bucket', async () => {
    const extraction = makeExtraction({ meal_time: 'lunch' })
    mockMatchItem.mockResolvedValue(makeMatchedItem('Food', 100))

    const capturedRows: FoodLogInsertRow[] = []
    const deps = makeDeps(
      async () => extraction,
      async (rows) => {
        capturedRows.push(...rows)
        return { error: null }
      }
    )

    // With mealOverride = 'breakfast' → should win over 'lunch' from parser
    await logSubmission(deps, {
      userId: 'u1',
      text: 'some food',
      source: 'app',
      mealOverride: 'breakfast',
      dateOverride: null,
      assumeDefaults: true,
    })
    expect(capturedRows[0].meal_type).toBe('breakfast')

    capturedRows.length = 0

    // Without override, parsed.meal_time = 'lunch' wins
    await logSubmission(deps, {
      userId: 'u1',
      text: 'some food',
      source: 'app',
      mealOverride: null,
      dateOverride: null,
      assumeDefaults: true,
    })
    expect(capturedRows[0].meal_type).toBe('lunch')
  })

  it('uses bucket when no override and no parsed meal_time', async () => {
    const extraction = makeExtraction({ meal_time: null })
    mockMatchItem.mockResolvedValue(makeMatchedItem('Food', 100))

    const capturedRows: FoodLogInsertRow[] = []
    const deps = makeDeps(
      async () => extraction,
      async (rows) => {
        capturedRows.push(...rows)
        return { error: null }
      },
      // Provide a fixed "now" at 18:00 → should bucket to 'dinner'
      { now: () => new Date('2024-01-15T18:00:00') }
    )

    await logSubmission(deps, {
      userId: 'u1',
      text: 'some food',
      source: 'app',
      mealOverride: null,
      dateOverride: null,
      assumeDefaults: true,
    })
    expect(capturedRows[0].meal_type).toBe('dinner')
  })

  it('dateOverride sets the calendar day with the correct slot hour', async () => {
    const extraction = makeExtraction({ meal_time: null })
    mockMatchItem.mockResolvedValue(makeMatchedItem('Food', 100))

    const capturedRows: FoodLogInsertRow[] = []
    const deps = makeDeps(
      async () => extraction,
      async (rows) => {
        capturedRows.push(...rows)
        return { error: null }
      },
      { now: () => new Date('2024-03-20T09:00:00') }
    )

    await logSubmission(deps, {
      userId: 'u1',
      text: 'some food',
      source: 'app',
      mealOverride: 'dinner',
      dateOverride: '2024-01-01',
      assumeDefaults: true,
    })

    const entryDate = new Date(capturedRows[0].entry_date)
    // Day should be 2024-01-01
    expect(entryDate.getFullYear()).toBe(2024)
    expect(entryDate.getMonth()).toBe(0) // January = 0
    expect(entryDate.getDate()).toBe(1)
    // Hour should be 19:00 (dinner slot)
    expect(entryDate.getHours()).toBe(19)
  })

  it('propagates insert error as Error', async () => {
    mockMatchItem.mockResolvedValue(makeMatchedItem('Food', 100))

    const deps = makeDeps(
      async () => makeExtraction(),
      async () => ({ error: 'Database constraint violation' })
    )

    await expect(
      logSubmission(deps, {
        userId: 'u1',
        text: 'some food',
        source: 'app',
        mealOverride: null,
        dateOverride: null,
        assumeDefaults: true,
      })
    ).rejects.toThrow('Database constraint violation')
  })
})

// ---------------------------------------------------------------------------
// resolveEntryDate tests
// ---------------------------------------------------------------------------

describe('resolveEntryDate', () => {
  it('applies slot hour to dateOverride calendar day', () => {
    const d = resolveEntryDate('breakfast', '2024-06-15', null)
    expect(d.getFullYear()).toBe(2024)
    expect(d.getMonth()).toBe(5) // June = 5
    expect(d.getDate()).toBe(15)
    expect(d.getHours()).toBe(8)
  })

  it('applies lunch slot hour', () => {
    const d = resolveEntryDate('lunch', '2024-06-15', null)
    expect(d.getHours()).toBe(12)
    expect(d.getMinutes()).toBe(30)
  })

  it('applies snack slot hour', () => {
    const d = resolveEntryDate('snack', '2024-06-15', null)
    expect(d.getHours()).toBe(15)
  })

  it('applies dinner slot hour', () => {
    const d = resolveEntryDate('dinner', '2024-06-15', null)
    expect(d.getHours()).toBe(19)
  })

  it('uses computeEntryDate when no dateOverride', () => {
    const now = new Date('2024-06-15T10:00:00')
    const d = resolveEntryDate('dinner', null, -1, now)
    // date_offset_days = -1 → yesterday
    expect(d.getDate()).toBe(14)
    expect(d.getHours()).toBe(19)
  })
})
