import { describe, it, expect } from 'vitest'
import { sumMacros, groupLogsByDay, localDayKey, groupDayIntoMealSections } from '../totals'
import type { FoodLog } from '@/lib/database.types'

let idCounter = 0
function log(partial: Partial<FoodLog>): FoodLog {
  return {
    id: `id-${++idCounter}`, user_id: 'u', entry_date: '2026-06-08T12:00:00',
    raw_input: null, food_name: 'x', calories: null, protein_g: null, carbs_g: null,
    fat_g: null, fiber_g: null, sugar_g: null, sodium_mg: null, saturated_fat_g: null,
    meal_type: null, notes: null, source: 'app', is_deleted: false,
    created_at: '', updated_at: '',
    grams: null, match_source: null, match_ref: null,
    recipe_id: null, custom_food_id: null, submission_id: null,
    image_path: null, weight_estimated: false,
    ...partial,
  }
}

describe('sumMacros', () => {
  it('sums macros treating null as 0', () => {
    const t = sumMacros([log({ calories: 100, protein_g: 10 }), log({ calories: 50 })])
    expect(t).toEqual({ calories: 150, protein_g: 10, carbs_g: 0, fat_g: 0 })
  })
})

describe('groupLogsByDay', () => {
  it('groups same-local-day entries and sorts days descending', () => {
    const groups = groupLogsByDay([
      log({ entry_date: '2026-06-08T08:00:00', calories: 100 }),
      log({ entry_date: '2026-06-08T20:00:00', calories: 200 }),
      log({ entry_date: '2026-06-07T12:00:00', calories: 50 }),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0].dayKey > groups[1].dayKey).toBe(true)
    const jun8 = groups.find((g) => g.dayKey === localDayKey(new Date('2026-06-08T08:00:00')))
    expect(jun8?.totals.calories).toBe(300)
  })
})

describe('groupDayIntoMealSections', () => {
  it('uses meal_type when set', () => {
    const logs = [
      log({ meal_type: 'breakfast', calories: 300, entry_date: '2026-06-08T08:00:00' }),
      log({ meal_type: 'dinner', calories: 700, entry_date: '2026-06-08T19:00:00' }),
    ]
    const sections = groupDayIntoMealSections(logs)
    expect(sections).toHaveLength(2)
    expect(sections[0].meal).toBe('breakfast')
    expect(sections[0].totals.calories).toBe(300)
    expect(sections[1].meal).toBe('dinner')
    expect(sections[1].totals.calories).toBe(700)
  })

  it('falls back to hour-bucket for null meal_type', () => {
    // 08:00 → breakfast, 19:00 → dinner
    const logs = [
      log({ meal_type: null, entry_date: '2026-06-08T08:00:00', calories: 200 }),
      log({ meal_type: null, entry_date: '2026-06-08T19:00:00', calories: 500 }),
    ]
    const sections = groupDayIntoMealSections(logs)
    expect(sections.map((s) => s.meal)).toContain('breakfast')
    expect(sections.map((s) => s.meal)).toContain('dinner')
    const bfast = sections.find((s) => s.meal === 'breakfast')!
    expect(bfast.totals.calories).toBe(200)
  })

  it('groups logs with same submission_id into one submission group', () => {
    const subId = 'sub-abc'
    const logs = [
      log({ submission_id: subId, food_name: 'chicken', meal_type: 'lunch', entry_date: '2026-06-08T12:00:00', calories: 300 }),
      log({ submission_id: subId, food_name: 'rice', meal_type: 'lunch', entry_date: '2026-06-08T12:00:00', calories: 200 }),
      log({ submission_id: 'sub-xyz', food_name: 'apple', meal_type: 'lunch', entry_date: '2026-06-08T12:00:00', calories: 80 }),
    ]
    const sections = groupDayIntoMealSections(logs)
    expect(sections).toHaveLength(1)
    expect(sections[0].meal).toBe('lunch')
    expect(sections[0].submissions).toHaveLength(2)
    const group = sections[0].submissions.find((s) => s.submissionId === subId)!
    expect(group.logs).toHaveLength(2)
    expect(group.totals.calories).toBe(500)
  })

  it('uses log.id as submission key when submission_id is null', () => {
    const l1 = log({ submission_id: null, meal_type: 'snack', entry_date: '2026-06-08T15:00:00' })
    const l2 = log({ submission_id: null, meal_type: 'snack', entry_date: '2026-06-08T15:00:00' })
    const sections = groupDayIntoMealSections([l1, l2])
    expect(sections[0].submissions).toHaveLength(2)
    expect(sections[0].submissions[0].submissionId).toBe(l1.id)
    expect(sections[0].submissions[1].submissionId).toBe(l2.id)
  })

  it('omits empty sections and preserves MEAL_ORDER', () => {
    const logs = [
      log({ meal_type: 'dinner', entry_date: '2026-06-08T19:00:00' }),
      log({ meal_type: 'breakfast', entry_date: '2026-06-08T08:00:00' }),
    ]
    const sections = groupDayIntoMealSections(logs)
    expect(sections).toHaveLength(2)
    expect(sections[0].meal).toBe('breakfast')
    expect(sections[1].meal).toBe('dinner')
  })

  it('computes correct totals per section', () => {
    const logs = [
      log({ meal_type: 'breakfast', calories: 100, protein_g: 10, carbs_g: 20, fat_g: 5, entry_date: '2026-06-08T08:00:00' }),
      log({ meal_type: 'breakfast', calories: 200, protein_g: 20, carbs_g: 30, fat_g: 8, entry_date: '2026-06-08T08:30:00' }),
    ]
    const sections = groupDayIntoMealSections(logs)
    expect(sections[0].totals).toEqual({ calories: 300, protein_g: 30, carbs_g: 50, fat_g: 13 })
  })

  it('returns empty array for no logs', () => {
    expect(groupDayIntoMealSections([])).toEqual([])
  })
})
