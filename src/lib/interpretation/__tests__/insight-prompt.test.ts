import { describe, it, expect } from 'vitest'
import { buildInsightPrompt } from '../insight-prompt'

describe('buildInsightPrompt', () => {
  const baseRequest = {
    biomarkerName: 'HbA1c',
    unit: '%',
    values: [
      { date: '2026-01-01', value: 5.4, testName: 'Jan Test' },
    ],
    refRangeLow: 4,
    refRangeHigh: 5.6,
    profile: {
      sex: 'male',
      dateOfBirth: '1990-01-01',
    },
  }

  it('returns system and user prompts with biomarker info and values', () => {
    const result = buildInsightPrompt(baseRequest)

    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')

    // User prompt contains biomarker and value info
    expect(result.user).toContain('HbA1c')
    expect(result.user).toContain('5.4')
    expect(result.user).toContain('Jan Test')
    expect(result.user).toContain('2026-01-01')
  })

  it('includes reference range in user prompt', () => {
    const result = buildInsightPrompt(baseRequest)
    expect(result.user).toContain('4')
    expect(result.user).toContain('5.6')
  })

  it('includes profile info in user prompt', () => {
    const result = buildInsightPrompt(baseRequest)
    expect(result.user).toContain('male')
    // Should contain age computed from dateOfBirth
    expect(result.user).toMatch(/Age: \d+ years/)
  })

  it('includes all values when multiple data points provided', () => {
    const multipleValues = {
      ...baseRequest,
      values: [
        { date: '2026-01-01', value: 5.4, testName: 'Jan Test' },
        { date: '2026-02-01', value: 5.2, testName: 'Feb Test' },
        { date: '2026-03-01', value: 5.0, testName: 'Mar Test' },
      ],
    }
    const result = buildInsightPrompt(multipleValues)

    expect(result.user).toContain('5.4')
    expect(result.user).toContain('5.2')
    expect(result.user).toContain('5 %')
    expect(result.user).toContain('Jan Test')
    expect(result.user).toContain('Feb Test')
    expect(result.user).toContain('Mar Test')
    expect(result.user).toContain('3 data points')
  })

  it('system prompt includes critical rules', () => {
    const result = buildInsightPrompt(baseRequest)
    expect(result.system).toContain('NEVER diagnose conditions')
    expect(result.system).toContain('not medical advice')
  })

  it('system prompt describes personalized insight structure', () => {
    const result = buildInsightPrompt(baseRequest)
    expect(result.system).toContain('Current status')
    expect(result.system).toContain('Trend analysis')
  })
})
