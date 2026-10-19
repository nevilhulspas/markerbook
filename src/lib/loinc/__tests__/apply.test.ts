import { describe, it, expect } from 'vitest'
import { buildBiomarkerUpdate } from '../apply-core'
import type { MappingDecision } from '../types'

describe('buildBiomarkerUpdate', () => {
  it('approve: sets loinc_code + method, keeps name unless override', () => {
    const d: MappingDecision = {
      id: 'b1',
      decision: 'approve',
      loincCode: '2276-4',
      loincName: 'Ferritin [Mass/volume] in Serum or Plasma',
      ucumUnit: 'ng/mL',
      method: null,
      displayNameOverride: null,
    }
    expect(buildBiomarkerUpdate(d, { name: 'Ferritin' })).toEqual({
      id: 'b1',
      fields: { loinc_code: '2276-4', method: null },
    })
  })
  it('override display name replaces name', () => {
    const d: MappingDecision = {
      id: 'b2',
      decision: 'override',
      loincCode: '718-7',
      loincName: 'x',
      ucumUnit: 'g/dL',
      method: null,
      displayNameOverride: 'Hemoglobin',
    }
    expect(buildBiomarkerUpdate(d, { name: 'HGB' })).toEqual({
      id: 'b2',
      fields: { loinc_code: '718-7', method: null, name: 'Hemoglobin' },
    })
  })
  it('skip: returns null (no update)', () => {
    const d: MappingDecision = {
      id: 'b3',
      decision: 'skip',
      loincCode: null,
      loincName: null,
      ucumUnit: null,
      method: null,
      displayNameOverride: null,
    }
    expect(buildBiomarkerUpdate(d, { name: 'Custom' })).toBeNull()
  })
})
