import { describe, it, expect } from 'vitest'
import { rankCandidates, normalizeName } from '../score'
import type { BiomarkerToMatch, LoincTerm } from '../types'

/** Helper to build a realistic LoincTerm with sensible defaults. */
function term(t: Partial<LoincTerm> & Pick<LoincTerm, 'code' | 'component'>): LoincTerm {
  return {
    property: null,
    system: 'Ser/Plas',
    scaleTyp: 'Qn',
    methodTyp: null,
    longCommonName: '',
    shortName: null,
    ucumUnit: null,
    classtype: 1,
    status: 'ACTIVE',
    ...t,
  }
}

const ferritin: BiomarkerToMatch = {
  id: 'b1',
  name: 'Ferritin',
  shortName: 'Ferritin',
  aliases: ['Serum ferritin'],
  category: 'Iron',
  currentUnit: 'ng/mL',
  userValueCount: 3,
}

describe('normalizeName', () => {
  it('normalizes names (lowercase, drops brackets + punctuation)', () => {
    expect(normalizeName('Serum Ferritin (S)')).toBe('serum ferritin s')
    expect(normalizeName('Gliadin peptide Ab.IgA')).toBe('gliadin peptide ab iga')
  })
})

describe('rankCandidates', () => {
  it('ranks exact-component + Ser/Plas + Qn + no-method + unit ~1.0 and #1', () => {
    const ranked = rankCandidates(ferritin, [
      term({
        code: '2276-4',
        component: 'Ferritin',
        longCommonName: 'Ferritin [Mass/volume] in Serum or Plasma',
        system: 'Ser/Plas',
        scaleTyp: 'Qn',
        methodTyp: null,
        ucumUnit: 'ng/mL',
        property: 'MCnc',
      }),
      term({
        code: '11111-1',
        component: 'Calcifediol',
        longCommonName: 'Calcifediol [Mass/volume] in Serum or Plasma',
        ucumUnit: 'ng/mL',
        property: 'MCnc',
      }),
    ])
    expect(ranked[0].code).toBe('2276-4')
    // base 1*0.75 + system .1 + scale .05 + method .05 + unit .05 = 1.0
    expect(ranked[0].confidence).toBeCloseTo(1.0, 5)
    // wrong component scores far below
    expect(ranked.find((c) => c.code === '11111-1')!.confidence).toBeLessThan(
      ranked[0].confidence,
    )
  })

  it('penalizes a non-blood (urine) specimen below the serum term', () => {
    const sodium: BiomarkerToMatch = {
      id: 'n', name: 'Sodium', shortName: 'Na', aliases: [], category: 'Electrolytes', currentUnit: 'mmol/L', userValueCount: 4,
    }
    const ranked = rankCandidates(sodium, [
      term({
        code: '2955-3',
        component: 'Sodium',
        longCommonName: 'Sodium [Moles/volume] in Urine',
        system: 'Urine',
        scaleTyp: 'Qn',
        ucumUnit: 'mmol/L',
        property: 'SCnc',
      }),
      term({
        code: '2951-2',
        component: 'Sodium',
        longCommonName: 'Sodium [Moles/volume] in Serum or Plasma',
        system: 'Ser/Plas',
        scaleTyp: 'Qn',
        ucumUnit: 'mmol/L',
        property: 'SCnc',
      }),
    ])
    expect(ranked[0].code).toBe('2951-2')
    expect(ranked.find((c) => c.code === '2955-3')!.confidence).toBeLessThan(
      ranked.find((c) => c.code === '2951-2')!.confidence,
    )
  })

  it('a urine-specimen biomarker prefers the Urine LOINC code over the serum one', () => {
    const creatinineUrine: BiomarkerToMatch = {
      id: 'cu', name: 'Creatinine (Urine)', shortName: null, aliases: [], category: 'kidney',
      currentUnit: 'mg/dL', userValueCount: 0, specimen: 'urine',
    }
    const ranked = rankCandidates(creatinineUrine, [
      term({ code: '2160-0', component: 'Creatinine', longCommonName: 'Creatinine [Mass/volume] in Serum or Plasma', system: 'Ser/Plas', ucumUnit: 'mg/dL' }),
      term({ code: '2161-8', component: 'Creatinine', longCommonName: 'Creatinine [Mass/volume] in Urine', system: 'Urine', ucumUnit: 'mg/dL' }),
    ])
    expect(ranked[0].code).toBe('2161-8') // urine code wins for a urine marker
    expect(ranked.find((c) => c.code === '2160-0')!.confidence).toBeLessThan(ranked[0].confidence)
  })

  it('penalizes a panel component below the clean match', () => {
    const ranked = rankCandidates(ferritin, [
      term({
        code: '2276-4',
        component: 'Ferritin',
        longCommonName: 'Ferritin [Mass/volume] in Serum or Plasma',
        ucumUnit: 'ng/mL',
      }),
      term({
        code: '33333-3',
        component: 'Ferritin panel',
        longCommonName: 'Ferritin panel [Mass/volume] in Serum or Plasma',
        ucumUnit: 'ng/mL',
      }),
    ])
    expect(ranked[0].code).toBe('2276-4')
    expect(ranked.find((c) => c.code === '33333-3')!.confidence).toBeLessThan(
      ranked[0].confidence,
    )
  })

  it('ranks the single-class Ig component above the combined IgA+IgG (Anti-DGP IgA)', () => {
    const dgp: BiomarkerToMatch = {
      id: 'd', name: 'Anti-DGP IgA', shortName: null, aliases: [], category: 'Immune', currentUnit: null, userValueCount: 2,
    }
    const ranked = rankCandidates(dgp, [
      term({
        code: '101564-3',
        component: 'Gliadin peptide Ab.IgA+IgG',
        longCommonName: 'Gliadin peptide IgA+IgG Ab [Units/volume] in Serum by Immunoassay',
        system: 'Ser',
        scaleTyp: 'Qn',
        methodTyp: 'IA',
      }),
      term({
        code: '58709-7',
        component: 'Gliadin peptide Ab.IgA',
        longCommonName: 'Gliadin peptide IgA Ab [Units/volume] in Serum',
        system: 'Ser',
        scaleTyp: 'Qn',
        methodTyp: null,
      }),
      term({
        code: '58710-5',
        component: 'Gliadin peptide Ab.IgG',
        longCommonName: 'Gliadin peptide IgG Ab [Units/volume] in Serum',
        system: 'Ser',
        scaleTyp: 'Qn',
        methodTyp: null,
      }),
    ])
    // The IgA component wins; the combined and the wrong-class (IgG) term rank below it.
    expect(ranked[0].code).toBe('58709-7')
    const igA = ranked.find((c) => c.code === '58709-7')!.confidence
    expect(ranked.find((c) => c.code === '101564-3')!.confidence).toBeLessThan(igA)
    expect(ranked.find((c) => c.code === '58710-5')!.confidence).toBeLessThan(igA)
  })

  it('prefers the generic specimen over a site-qualified blood term on a clamp tie', () => {
    const hb: BiomarkerToMatch = {
      id: 'h', name: 'Hemoglobin', shortName: 'Hb', aliases: [], category: 'CBC', currentUnit: 'g/dL', userValueCount: 5,
    }
    // Both are exact-component + Qn + method-less + unit-matching → confidence clamps to
    // 1.0 for each. The generic "Bld" (718-7) must still beat arterial "BldA" (30313-1),
    // even though "30313-1" sorts before "718-7" alphabetically.
    const ranked = rankCandidates(hb, [
      term({ code: '30313-1', component: 'Hemoglobin', longCommonName: 'Hemoglobin [Mass/volume] in Arterial blood', system: 'BldA', ucumUnit: 'g/dL' }),
      term({ code: '718-7', component: 'Hemoglobin', longCommonName: 'Hemoglobin [Mass/volume] in Blood', system: 'Bld', ucumUnit: 'g/dL' }),
    ])
    expect(ranked[0].confidence).toBe(ranked[1].confidence)
    expect(ranked[0].code).toBe('718-7')
  })

  it('does not let a ratio component win on a shared token — Osmolality must prefer 2692-2 over 13448-6', () => {
    // Regression for the 2026-06-20 mis-capture: "Osmolality (serum)" was scored
    // ≥0.6 against the composite ratio "Calcium/Osmolality" (13448-6) because the
    // token "osmolality" overlaps. Both terms tied at ~0.615 and the alphabetically
    // earlier code (13448-6) won the tiebreak, poisoning serum osmolality forever.
    const osmolality: BiomarkerToMatch = {
      id: 'o', name: 'Osmolality (serum)', shortName: null, aliases: [],
      category: 'Electrolytes', currentUnit: 'mOsm/kg', userValueCount: 0,
    }
    const ranked = rankCandidates(osmolality, [
      term({
        code: '13448-6',
        component: 'Calcium/Osmolality',
        longCommonName: 'Calcium/Osmolality [Substance Ratio] in Serum or Plasma',
        system: 'Ser/Plas',
        scaleTyp: 'Qn',
        property: 'SRto',
      }),
      term({
        code: '2692-2',
        component: 'Osmolality',
        longCommonName: 'Osmolality [Moles/volume] in Serum or Plasma',
        system: 'Ser/Plas',
        scaleTyp: 'Qn',
        // No ucumUnit on purpose: without the fix both terms tie at ~0.615 and the
        // alphabetically-earlier ratio code (13448-6) wins the tiebreak — exactly
        // the incident. The fix must make the simple analyte win on merit.
        property: 'Osmol',
      }),
    ])
    expect(ranked[0].code).toBe('2692-2')
    expect(ranked.find((c) => c.code === '13448-6')!.confidence).toBeLessThan(
      ranked.find((c) => c.code === '2692-2')!.confidence,
    )
  })

  it('drops a lone ratio component below the 0.6 capture threshold (so the marker stays unresolved)', () => {
    // When the only osmolality-ish candidate is the ratio, the resolver must fall
    // through to `unresolved` (CONFIDENCE_THRESHOLD = 0.6 in resolve.ts) rather than
    // capture a bogus "Calcium/Osmolality" biomarker.
    const osmolality: BiomarkerToMatch = {
      id: 'o', name: 'Osmolality (serum)', shortName: null, aliases: [],
      category: 'Electrolytes', currentUnit: 'mOsm/kg', userValueCount: 0,
    }
    const ranked = rankCandidates(osmolality, [
      term({
        code: '13448-6',
        component: 'Calcium/Osmolality',
        longCommonName: 'Calcium/Osmolality [Substance Ratio] in Serum or Plasma',
        system: 'Ser/Plas',
        scaleTyp: 'Qn',
        property: 'SRto',
      }),
    ])
    expect(ranked[0].confidence).toBeLessThan(0.6)
  })

  it('still matches a genuine ratio biomarker to its ratio term (no over-penalization)', () => {
    // The penalty must not fire when the biomarker is itself a ratio.
    const agRatio: BiomarkerToMatch = {
      id: 'ag', name: 'Albumin/Globulin ratio', shortName: 'A/G', aliases: [],
      category: 'Protein', currentUnit: null, userValueCount: 1,
    }
    const ranked = rankCandidates(agRatio, [
      term({
        code: '1759-0',
        component: 'Albumin/Globulin',
        longCommonName: 'Albumin/Globulin [Mass Ratio] in Serum or Plasma',
        system: 'Ser/Plas',
        scaleTyp: 'Qn',
        property: 'MRto',
      }),
    ])
    expect(ranked[0].code).toBe('1759-0')
    expect(ranked[0].confidence).toBeGreaterThanOrEqual(0.6)
  })

  // INR is a legitimate single-concept marker whose LOINC term carries a ratio
  // PROPERTY (RelRto) but a single-token component ("INR", no "/"). Detection is
  // component-based, so neither the exact label nor decorated labels ("PT INR",
  // "INR (PT)") get the composite penalty — they must still resolve to 6301-6.
  it.each(['INR', 'PT INR', 'INR (PT)'])(
    'does not penalize the single-concept INR marker "%s" (ratio PROPERTY, non-composite component)',
    (name) => {
      const inr: BiomarkerToMatch = {
        id: 'inr', name, shortName: 'INR', aliases: [],
        category: 'Coagulation', currentUnit: null, userValueCount: 2,
      }
      const ranked = rankCandidates(inr, [
        term({
          code: '6301-6',
          component: 'INR',
          longCommonName: 'INR in Platelet poor plasma by Coagulation assay',
          system: 'Plas',
          scaleTyp: 'Qn',
          property: 'RelRto',
        }),
      ])
      expect(ranked[0].code).toBe('6301-6')
      expect(ranked[0].confidence).toBeGreaterThanOrEqual(0.6)
    },
  )

  it('breaks confidence ties deterministically by code order', () => {
    const base = {
      component: 'Ferritin',
      longCommonName: 'Ferritin [Mass/volume] in Serum or Plasma',
      system: 'Ser/Plas',
      scaleTyp: 'Qn',
      methodTyp: null,
      ucumUnit: 'ng/mL',
      property: 'MCnc',
    } as const
    const ranked = rankCandidates(ferritin, [
      term({ ...base, code: '9999-9' }),
      term({ ...base, code: '1111-1' }),
    ])
    expect(ranked[0].confidence).toBe(ranked[1].confidence)
    expect(ranked.map((c) => c.code)).toEqual(['1111-1', '9999-9'])
  })
})
