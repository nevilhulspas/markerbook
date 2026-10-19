import { describe, it, expect } from 'vitest'

import {
  buildInsightsChatSystemPrompt,
  type RmrContext,
} from '@/lib/insights/insights-chat-prompt'
import type { ProfileContext } from '@/lib/interpretation/types'

const profile: ProfileContext = {
  dateOfBirth: null,
  sex: null,
  heightCm: null,
  weightKg: null,
  activityLevel: null,
}

function buildWithRmr(rmr: RmrContext | null): string {
  return buildInsightsChatSystemPrompt({
    markerHistory: [],
    profile,
    supplements: [],
    rmr,
  })
}

describe('formatRmr (via buildInsightsChatSystemPrompt)', () => {
  it('renders the RMR section with measured/predicted RMR, fuel mix, and TDEE targets', () => {
    const rmr: RmrContext = {
      testDate: '2026-05-27',
      rmrKcal: 2229,
      predictedRmrKcal: 1887,
      rer: 0.99,
      fuelCarbPct: 97,
      fuelFatPct: 3,
      tdee: 3455,
      fatLoss: [2455, 2955],
      leanGain: [3705, 3955],
      activityLevel: 'moderate',
    }
    const prompt = buildWithRmr(rmr)

    expect(prompt).toContain('## Resting Metabolic Rate (RMR)')
    // Measured vs predicted RMR.
    expect(prompt).toContain('Measured RMR: 2229 kcal/day')
    expect(prompt).toContain('Predicted RMR: 1887 kcal/day')
    // Fuel mix.
    expect(prompt).toContain('97% carbs')
    expect(prompt).toContain('3% fat')
    // TDEE / fat-loss / lean-gain targets for the user's activity level.
    expect(prompt).toContain('activity level: moderate')
    expect(prompt).toContain('3455 kcal/day')
    expect(prompt).toContain('2455–2955 kcal/day')
    expect(prompt).toContain('3705–3955 kcal/day')
  })

  it('falls back to RER when no carb/fat split, and notes missing activity level', () => {
    const rmr: RmrContext = {
      testDate: '2026-05-27',
      rmrKcal: 2000,
      predictedRmrKcal: null,
      rer: 0.85,
      fuelCarbPct: null,
      fuelFatPct: null,
      tdee: null,
      fatLoss: null,
      leanGain: null,
      activityLevel: null,
    }
    const prompt = buildWithRmr(rmr)

    expect(prompt).toContain('RER (respiratory exchange ratio): 0.85')
    expect(prompt).not.toContain('Predicted RMR')
    expect(prompt).toContain('no activity level set')
  })

  it('renders the empty state when there is no RMR test', () => {
    expect(buildWithRmr(null)).toContain('No RMR test data available.')
  })
})
