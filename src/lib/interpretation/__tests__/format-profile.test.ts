import { describe, it, expect } from 'vitest'
import { formatProfile } from '../prompt'
import type { ProfileContext } from '../types'

// Covers the medical-history extensions to formatProfile().
// The shape contract is: any field that is null/undefined is silently omitted,
// any present field renders as its own line, and the conditions list renders
// as a bulleted sub-list with "(ongoing)" when end_date is missing.

describe('formatProfile — AUT-854 medical-history fields', () => {
  it('returns the empty-state string when given an empty profile', () => {
    expect(formatProfile({})).toBe('No profile information available.')
  })

  it('renders only the present base fields, omitting null/undefined', () => {
    const out = formatProfile({
      sex: 'female',
      heightCm: 165,
      // weightKg deliberately undefined — must not appear
    })
    expect(out).toContain('Sex: female')
    expect(out).toContain('Height: 165 cm')
    expect(out).not.toContain('Weight')
    expect(out).not.toContain('Activity')
  })

  it('renders smoking, alcohol, pregnancy, diet on their own lines', () => {
    const out = formatProfile({
      smokingStatus: 'former',
      alcoholDrinksPerWeek: 2.5,
      pregnancyStatus: 'breastfeeding',
      dietPattern: 'vegan',
    })
    expect(out).toContain('Smoking: former')
    expect(out).toContain('Alcohol: ~2.5 drinks/week')
    expect(out).toContain('Pregnancy: breastfeeding')
    expect(out).toContain('Diet: vegan')
  })

  it("omits pregnancy from the prompt when set to 'not_applicable'", () => {
    // It's a user-side opt-out (e.g. men) — keeping it out of the prompt
    // avoids redundant noise next to the demographic Sex line.
    const out = formatProfile({
      sex: 'male',
      pregnancyStatus: 'not_applicable',
    })
    expect(out).toContain('Sex: male')
    expect(out).not.toContain('Pregnancy')
  })

  it('renders C-section and breastfed as explicit yes/no when set', () => {
    expect(formatProfile({ bornViaCsection: true })).toContain(
      'Born via C-section: yes'
    )
    expect(formatProfile({ bornViaCsection: false })).toContain(
      'Born via C-section: no'
    )
    // Null/undefined => omitted entirely
    expect(formatProfile({ bornViaCsection: null })).not.toContain('C-section')
    expect(formatProfile({})).not.toContain('C-section')
  })

  it('renders allergies and family history only when non-empty', () => {
    expect(
      formatProfile({ knownAllergies: 'penicillin, peanuts' })
    ).toContain('Known allergies: penicillin, peanuts')
    expect(formatProfile({ knownAllergies: '   ' })).not.toContain(
      'Known allergies'
    )
    expect(
      formatProfile({ familyHistory: 'Father MI age 60' })
    ).toContain('Family history: Father MI age 60')
  })

  it('renders medical conditions as a bulleted sub-list with ongoing tag', () => {
    const profile: ProfileContext = {
      medicalConditions: [
        { name: 'Hypothyroidism', startDate: '2020-03-01', endDate: null },
        {
          name: 'Iron deficiency',
          startDate: '2022-01-01',
          endDate: '2022-09-01',
          notes: 'Resolved after supplementation',
        },
        { name: 'Hayfever', startDate: null, endDate: null },
      ],
    }
    const out = formatProfile(profile)
    expect(out).toContain('Medical conditions:')
    // Ongoing entry: "since <start>, ongoing"
    expect(out).toMatch(/- Hypothyroidism \(since 2020-03-01, ongoing\)/)
    // Resolved range
    expect(out).toMatch(/- Iron deficiency \(2022-01-01 – 2022-09-01\)/)
    // Notes appended after em-dash
    expect(out).toContain('Resolved after supplementation')
    // No dates at all => "(ongoing)"
    expect(out).toMatch(/- Hayfever \(ongoing\)/)
  })

  it('renders extra_notes as a labeled trailing section', () => {
    const out = formatProfile({
      extraNotes: 'Recent flu in May — labs may still reflect inflammation',
    })
    expect(out).toContain('Additional notes from user:')
    expect(out).toContain('Recent flu in May')
  })

  it('trims whitespace and omits empty-string free-text fields', () => {
    const out = formatProfile({
      extraNotes: '   ',
      knownAllergies: '',
      familyHistory: '\n\n',
    })
    expect(out).toBe('No profile information available.')
  })

  it('preserves order: demographics → lifestyle → birth → free-text → conditions → notes', () => {
    const out = formatProfile({
      sex: 'female',
      smokingStatus: 'never',
      bornViaCsection: false,
      knownAllergies: 'cats',
      medicalConditions: [{ name: 'Asthma' }],
      extraNotes: 'sleeps well',
    })
    const idxSex = out.indexOf('Sex:')
    const idxSmoke = out.indexOf('Smoking:')
    const idxCsec = out.indexOf('Born via C-section:')
    const idxAllergies = out.indexOf('Known allergies:')
    const idxConditions = out.indexOf('Medical conditions:')
    const idxNotes = out.indexOf('Additional notes from user:')
    // Each section must appear exactly once
    expect(idxSex).toBeGreaterThanOrEqual(0)
    expect(idxSmoke).toBeGreaterThan(idxSex)
    expect(idxCsec).toBeGreaterThan(idxSmoke)
    expect(idxAllergies).toBeGreaterThan(idxCsec)
    expect(idxConditions).toBeGreaterThan(idxAllergies)
    expect(idxNotes).toBeGreaterThan(idxConditions)
  })
})
