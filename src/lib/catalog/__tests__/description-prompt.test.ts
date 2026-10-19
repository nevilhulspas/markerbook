import { describe, it, expect } from 'vitest'
import { buildDescriptionPrompt } from '../description-prompt'

describe('buildDescriptionPrompt', () => {
  it('returns system and user prompts containing biomarker context', () => {
    const result = buildDescriptionPrompt({
      name: 'HbA1c',
      category: 'Diabetes',
      unit: '%',
      panelName: 'Metabolic',
      systemName: 'Endocrine',
    })

    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')

    // User prompt contains biomarker context
    expect(result.user).toContain('HbA1c')
    expect(result.user).toContain('Diabetes')
    expect(result.user).toContain('%')
    expect(result.user).toContain('Metabolic')
    expect(result.user).toContain('Endocrine')
  })

  it('omits panelName from user prompt when null', () => {
    const result = buildDescriptionPrompt({
      name: 'HbA1c',
      category: 'Diabetes',
      unit: '%',
      panelName: null,
      systemName: 'Endocrine',
    })

    expect(result.user).toContain('HbA1c')
    expect(result.user).not.toContain('Panel')
    expect(result.user).toContain('Endocrine')
  })

  it('omits systemName from user prompt when null', () => {
    const result = buildDescriptionPrompt({
      name: 'HbA1c',
      category: 'Diabetes',
      unit: '%',
      panelName: 'Metabolic',
      systemName: null,
    })

    expect(result.user).toContain('Metabolic')
    expect(result.user).not.toContain('System')
  })

  it('system prompt includes required section headings', () => {
    const result = buildDescriptionPrompt({
      name: 'HbA1c',
      category: 'Diabetes',
      unit: '%',
      panelName: null,
      systemName: null,
    })

    expect(result.system).toContain('What It Measures')
    expect(result.system).toContain('Why It Matters')
    expect(result.system).toContain('Key Factors')
  })

  it('system prompt includes critical rules about no personalized advice', () => {
    const result = buildDescriptionPrompt({
      name: 'HbA1c',
      category: 'Diabetes',
      unit: '%',
      panelName: null,
      systemName: null,
    })

    expect(result.system).toContain('Do NOT provide personalized medical advice')
    expect(result.system).toContain('Do NOT reference specific user values')
  })
})
