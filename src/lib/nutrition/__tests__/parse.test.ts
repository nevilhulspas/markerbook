import { vi } from 'vitest'

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate }
  },
}))

import { describe, it, expect } from 'vitest'
import { isUndoCommand, computeEntryDate, bucketMealTime } from '../parse'
import { appHour, appTodayISO } from '@/lib/dates/today'

describe('isUndoCommand', () => {
  it('matches English + Dutch undo phrases', () => {
    expect(isUndoCommand('undo')).toBe(true)
    expect(isUndoCommand('Oops')).toBe(true)
    expect(isUndoCommand('delete last entry')).toBe(true)
    expect(isUndoCommand('maak dat ongedaan')).toBe(true)
  })
  it('does not match a normal meal', () => {
    expect(isUndoCommand('200g chicken with rice')).toBe(false)
  })
})

describe('computeEntryDate', () => {
  // 10:00 in Amsterdam (summer time, UTC+2).
  const now = new Date('2026-06-08T08:00:00Z')
  it('applies a day offset on the app calendar', () => {
    const d = computeEntryDate(-1, null, now)
    expect(appTodayISO(d)).toBe('2026-06-07')
    expect(appHour(d)).toBe(10)
  })
  it('sets dinner hour on the app clock', () => {
    const d = computeEntryDate(0, 'dinner', now)
    expect(d.toISOString()).toBe('2026-06-08T17:00:00.000Z')
  })
  it('defaults to now when no offset/meal', () => {
    const d = computeEntryDate(null, null, now)
    expect(d.getTime()).toBe(now.getTime())
  })
  it("puts yesterday's dinner on yesterday in Amsterdam just after midnight (regression: server UTC)", () => {
    // 00:30 on 9 June in Amsterdam is still 8 June in UTC.
    const justAfterMidnight = new Date('2026-06-08T22:30:00Z')
    const d = computeEntryDate(-1, 'dinner', justAfterMidnight)
    expect(appTodayISO(d)).toBe('2026-06-08')
    expect(appHour(d)).toBe(19)
  })
})

describe('bucketMealTime uses the app clock (regression: server UTC)', () => {
  it('buckets 12:30 in Amsterdam as lunch, though it is 10:30 UTC', () => {
    expect(bucketMealTime(new Date('2026-06-08T10:30:00Z'))).toBe('lunch')
  })
  it('buckets 18:00 in Amsterdam (winter, 17:00 UTC) as dinner', () => {
    expect(bucketMealTime(new Date('2026-01-08T17:00:00Z'))).toBe('dinner')
  })
})

import { parseFoodText } from '../parse'

describe('parseFoodText', () => {
  it('parses a valid JSON response (with code fences)', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '```json\n{"calories":95,"food_name":"Apple","meal_time":"snack"}\n```',
        },
      ],
    })
    const r = await parseFoodText('an apple')
    expect(r.food_name).toBe('Apple')
    expect(r.calories).toBe(95)
    expect(r.meal_time).toBe('snack')
    expect(r.protein_g).toBeNull()
  })

  it('throws on non-JSON output', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'sorry I cannot' }] })
    await expect(parseFoodText('???')).rejects.toThrow(/Could not read/)
  })

  it('throws when valid JSON is missing required fields', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: '{"calories":100}' }] })
    await expect(parseFoodText('mystery')).rejects.toThrow(/incomplete/)
  })
})
