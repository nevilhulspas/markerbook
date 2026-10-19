import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSessionUser, adminUpdate, mockRevalidatePath } = vi.hoisted(() => ({
  mockSessionUser: vi.fn(),
  adminUpdate: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('@/lib/supabase/session', () => ({ getSessionUser: mockSessionUser }))
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: () => ({
      update: (values: unknown) => {
        const filters: Array<[string, unknown]> = []
        const result = () => Promise.resolve(adminUpdate(values, filters))
        const chain = {
          eq: (col: string, v: unknown) => (filters.push([col, v]), chain),
          select: () => ({ then: (resolve: (v: unknown) => unknown) => result().then(resolve) }),
          then: (resolve: (v: unknown) => unknown) => result().then(resolve),
        }
        return chain
      },
    }),
  },
}))

import { setNutritionTargets } from '../nutrition-settings'

const targets = { calories: 2200, protein_g: 150, carbs_g: 220, fat_g: 70 }

describe('setNutritionTargets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionUser.mockResolvedValue({ supabase: {}, user: { id: 'u1' }, authError: null })
  })

  it('saves the targets on the signed-in profile', async () => {
    adminUpdate.mockReturnValue({ data: [{ id: 'u1' }], error: null })

    expect(await setNutritionTargets(targets)).toEqual({ error: null })
    expect(adminUpdate.mock.calls[0]).toEqual([
      {
        nutrition_calorie_target: 2200,
        nutrition_protein_target_g: 150,
        nutrition_carbs_target_g: 220,
        nutrition_fat_target_g: 70,
      },
      [['id', 'u1']],
    ])
    expect(mockRevalidatePath).toHaveBeenCalledWith('/nutrition')
  })

  it('reports an error when no profile row was updated', async () => {
    adminUpdate.mockReturnValue({ data: [], error: null })

    const res = await setNutritionTargets(targets)

    expect(res.error).toMatch(/profile/i)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('returns the database error', async () => {
    adminUpdate.mockReturnValue({ data: null, error: { message: 'db down' } })

    expect(await setNutritionTargets(targets)).toEqual({ error: 'db down' })
  })
})
