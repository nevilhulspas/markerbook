import { vi } from 'vitest'

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate }
  },
}))

import { describe, it, expect } from 'vitest'
import {
  buildExtractPrompt,
  parseFoodTextV2,
  bucketMealTime,
  parseSaveCommand,
} from '../parse'
import { extractedItemSchema, extractionV2Schema } from '../types'

// ── extractionV2Schema ────────────────────────────────────────────────────────

describe('extractionV2Schema', () => {
  const validPayload = {
    items: [
      {
        query: 'big mac',
        grams: 400,
        estimated_calories: 1080,
        estimated_protein_g: 52,
        estimated_carbs_g: 94,
        estimated_fat_g: 58,
        estimated_fiber_g: 6,
        estimated_sugar_g: 18,
        estimated_sodium_mg: 2100,
        estimated_saturated_fat_g: 22,
      },
      {
        query: 'french fries fast food',
        grams: 117,
        estimated_calories: 320,
        estimated_protein_g: 4,
        estimated_carbs_g: 43,
        estimated_fat_g: 15,
        estimated_fiber_g: 3,
        estimated_sugar_g: 0,
        estimated_sodium_mg: 400,
        estimated_saturated_fat_g: 2,
      },
      {
        query: 'cola soft drink',
        grams: 500,
        estimated_calories: 210,
        estimated_protein_g: 0,
        estimated_carbs_g: 55,
        estimated_fat_g: 0,
        estimated_fiber_g: 0,
        estimated_sugar_g: 55,
        estimated_sodium_mg: 45,
        estimated_saturated_fat_g: 0,
      },
    ],
    food_name: '2x Big Mac meal with fries and cola',
    notes: null,
    date_offset_days: null,
    meal_time: 'lunch',
    question: null,
  }

  it('parses a valid 3-item payload', () => {
    const result = extractionV2Schema.safeParse(validPayload)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.items).toHaveLength(3)
    expect(result.data.food_name).toBe('2x Big Mac meal with fries and cola')
    expect(result.data.meal_time).toBe('lunch')
    expect(result.data.question).toBeNull()
  })

  it('fails when items array is missing', () => {
    const { items: _items, ...rest } = validPayload
    const result = extractionV2Schema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('fails when items array is empty', () => {
    const result = extractionV2Schema.safeParse({ ...validPayload, items: [] })
    expect(result.success).toBe(false)
  })

  it('passes through a question string', () => {
    const result = extractionV2Schema.safeParse({
      ...validPayload,
      question: 'Does the 200g cover just the chicken, or the rice too?',
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.question).toBe('Does the 200g cover just the chicken, or the rice too?')
  })

  it('coerces missing question to null', () => {
    const { question: _q, ...rest } = validPayload
    const result = extractionV2Schema.safeParse(rest)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.question).toBeNull()
  })

  it('coerces null meal_time to null', () => {
    const result = extractionV2Schema.safeParse({ ...validPayload, meal_time: null })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.meal_time).toBeNull()
  })

  it('accepts an item with grams: null (both schemas)', () => {
    const nullGramsItem = { ...validPayload.items[0], grams: null }
    const itemResult = extractedItemSchema.safeParse(nullGramsItem)
    expect(itemResult.success).toBe(true)
    if (itemResult.success) expect(itemResult.data.grams).toBeNull()

    const fullResult = extractionV2Schema.safeParse({
      ...validPayload,
      items: [nullGramsItem],
    })
    expect(fullResult.success).toBe(true)
    if (!fullResult.success) return
    expect(fullResult.data.items[0].grams).toBeNull()
  })
})

// ── buildExtractPrompt ────────────────────────────────────────────────────────

describe('buildExtractPrompt', () => {
  it('contains "Saved meals" section with names when libraryNames provided', () => {
    const prompt = buildExtractPrompt(['Body Factory Lean', 'Eiwitshake'], false)
    expect(prompt).toContain('Saved meals and foods')
    expect(prompt).toContain('- Body Factory Lean')
    expect(prompt).toContain('- Eiwitshake')
  })

  it('does NOT contain saved meals section when libraryNames is empty', () => {
    const prompt = buildExtractPrompt([], false)
    expect(prompt).not.toContain('Saved meals and foods')
  })

  it('contains countable-item weight guidance (ported from caltrack)', () => {
    const prompt = buildExtractPrompt([], false)
    expect(prompt).toContain('When the user counts items')
    expect(prompt).toContain('Medium chicken egg: 50g shelled. "two eggs" => grams: 100')
    expect(prompt).toContain('Slice of Dutch toast / boterham: 35g. "twee boterhammen" => grams: 70')
  })

  it('contains "Never ask questions" when assumeDefaults is true', () => {
    const prompt = buildExtractPrompt([], true)
    expect(prompt).toContain('Never ask questions')
    expect(prompt).not.toContain('Clarifying questions')
  })

  it('contains clarifying block when assumeDefaults is false', () => {
    const prompt = buildExtractPrompt([], false)
    expect(prompt).toContain('Clarifying questions')
    expect(prompt).not.toContain('Never ask questions')
  })

  it('can include both saved meals and clarifying block', () => {
    const prompt = buildExtractPrompt(['My Protein Shake'], false)
    expect(prompt).toContain('Saved meals and foods')
    expect(prompt).toContain('Clarifying questions')
  })

  it('can include saved meals with assumeDefaults', () => {
    const prompt = buildExtractPrompt(['My Protein Shake'], true)
    expect(prompt).toContain('Saved meals and foods')
    expect(prompt).toContain('Never ask questions')
  })
})

// ── parseFoodTextV2 ───────────────────────────────────────────────────────────

const mcPayload = {
  items: [
    {
      query: 'big mac',
      grams: 400,
      estimated_calories: 1080,
      estimated_protein_g: 52,
      estimated_carbs_g: 94,
      estimated_fat_g: 58,
      estimated_fiber_g: 6,
      estimated_sugar_g: 18,
      estimated_sodium_mg: 2100,
      estimated_saturated_fat_g: 22,
    },
    {
      query: 'french fries fast food',
      grams: 117,
      estimated_calories: 320,
      estimated_protein_g: 4,
      estimated_carbs_g: 43,
      estimated_fat_g: 15,
      estimated_fiber_g: 3,
      estimated_sugar_g: 0,
      estimated_sodium_mg: 400,
      estimated_saturated_fat_g: 2,
    },
    {
      query: 'filet o fish sandwich',
      grams: 142,
      estimated_calories: 390,
      estimated_protein_g: 15,
      estimated_carbs_g: 39,
      estimated_fat_g: 19,
      estimated_fiber_g: 1,
      estimated_sugar_g: 5,
      estimated_sodium_mg: 560,
      estimated_saturated_fat_g: 4,
    },
  ],
  food_name: '2x Big Mac, french fries and one Filet O Fish',
  notes: null,
  date_offset_days: null,
  meal_time: null,
  question: null,
}

describe('parseFoodTextV2', () => {
  it('parses a fenced 3-item response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '```json\n' + JSON.stringify(mcPayload) + '\n```' }],
    })
    const result = await parseFoodTextV2('2x big mac, french fries and one filet o fish', {
      libraryNames: [],
      assumeDefaults: true,
    })
    expect(result.items).toHaveLength(3)
    expect(result.food_name).toBe('2x Big Mac, french fries and one Filet O Fish')
  })

  it('throws /Could not read/ on non-JSON output', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Sorry, I cannot parse that.' }],
    })
    await expect(
      parseFoodTextV2('???', { libraryNames: [], assumeDefaults: true })
    ).rejects.toThrow(/Could not read/)
  })

  it('throws /incomplete/ when valid JSON is missing items', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ food_name: 'mystery', notes: null }),
        },
      ],
    })
    await expect(
      parseFoodTextV2('mystery', { libraryNames: [], assumeDefaults: false })
    ).rejects.toThrow(/incomplete/)
  })
})

// ── bucketMealTime ────────────────────────────────────────────────────────────

describe('bucketMealTime', () => {
  function h(hour: number, minute = 0): Date {
    const d = new Date(2026, 5, 10)
    d.setHours(hour, minute, 0, 0)
    return d
  }

  it('10:59 → breakfast', () => expect(bucketMealTime(h(10, 59))).toBe('breakfast'))
  it('11:00 → lunch', () => expect(bucketMealTime(h(11, 0))).toBe('lunch'))
  it('13:59 → lunch', () => expect(bucketMealTime(h(13, 59))).toBe('lunch'))
  it('14:00 → snack', () => expect(bucketMealTime(h(14, 0))).toBe('snack'))
  it('16:59 → snack', () => expect(bucketMealTime(h(16, 59))).toBe('snack'))
  it('17:00 → dinner', () => expect(bucketMealTime(h(17, 0))).toBe('dinner'))
  it('23:00 → dinner', () => expect(bucketMealTime(h(23, 0))).toBe('dinner'))
  it('00:00 → breakfast', () => expect(bucketMealTime(h(0, 0))).toBe('breakfast'))
})

// ── parseSaveCommand ──────────────────────────────────────────────────────────

describe('parseSaveCommand', () => {
  it('"save this as Body Factory Lean" → "Body Factory Lean"', () => {
    expect(parseSaveCommand('save this as Body Factory Lean')).toBe('Body Factory Lean')
  })

  it('"save that as My Protein Shake." → "My Protein Shake"', () => {
    expect(parseSaveCommand('save that as My Protein Shake.')).toBe('My Protein Shake')
  })

  it('"save it as Dinner Bowl" → "Dinner Bowl"', () => {
    expect(parseSaveCommand('save it as Dinner Bowl')).toBe('Dinner Bowl')
  })

  it('"save as Quick Lunch" → "Quick Lunch"', () => {
    expect(parseSaveCommand('save as Quick Lunch')).toBe('Quick Lunch')
  })

  it('"save the last meal as Pre-Workout Oats" → "Pre-Workout Oats"', () => {
    expect(parseSaveCommand('save the last meal as Pre-Workout Oats')).toBe('Pre-Workout Oats')
  })

  it('"Sla dit op als eiwitshake." → "eiwitshake"', () => {
    expect(parseSaveCommand('Sla dit op als eiwitshake.')).toBe('eiwitshake')
  })

  it('"sla deze op als Dagschotel" → "Dagschotel"', () => {
    expect(parseSaveCommand('sla deze op als Dagschotel')).toBe('Dagschotel')
  })

  it('"an apple" → null', () => {
    expect(parseSaveCommand('an apple')).toBeNull()
  })

  it('"200g chicken" → null', () => {
    expect(parseSaveCommand('200g chicken')).toBeNull()
  })
})
