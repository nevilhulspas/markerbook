import { describe, it, expect } from 'vitest'

import type { Lab } from '@/lib/database.types'
import {
  labFormInitialValues,
  toCreateLabInput,
  toUpdateLabPatch,
  validateLabForm,
  type LabFormValues,
} from '../lab-form-values'

const lab: Lab = {
  id: 'lab-1',
  name: 'Acme Diagnostics',
  country: 'Netherlands',
  city: null,
  website: 'https://acme.example',
  description: null,
  status: 'pending',
  submitted_by: null,
  reviewed_by: null,
  reviewed_at: null,
  review_notes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const filled: LabFormValues = {
  name: '  Acme  ',
  country: ' Netherlands ',
  city: '   ',
  website: ' https://acme.example ',
  description: '',
  status: 'rejected',
}

describe('labFormInitialValues', () => {
  it('starts the add form empty with status approved', () => {
    expect(labFormInitialValues(null)).toEqual({
      name: '',
      country: '',
      city: '',
      website: '',
      description: '',
      status: 'approved',
    })
  })

  it('seeds the edit form from the lab, nulls as empty strings', () => {
    expect(labFormInitialValues(lab)).toEqual({
      name: 'Acme Diagnostics',
      country: 'Netherlands',
      city: '',
      website: 'https://acme.example',
      description: '',
      status: 'pending',
    })
  })
})

describe('validateLabForm', () => {
  it('requires a non-blank name', () => {
    expect(validateLabForm({ ...filled, name: '' })).toBe('Lab name is required.')
    expect(validateLabForm({ ...filled, name: '   ' })).toBe('Lab name is required.')
    expect(validateLabForm(filled)).toBeNull()
  })
})

describe('toCreateLabInput', () => {
  it('trims fields, maps blanks to null and includes the status', () => {
    expect(toCreateLabInput(filled)).toEqual({
      name: 'Acme',
      country: 'Netherlands',
      city: null,
      website: 'https://acme.example',
      description: null,
      status: 'rejected',
    })
  })
})

describe('toUpdateLabPatch', () => {
  it('trims fields, maps blanks to null and never sends a status', () => {
    const patch = toUpdateLabPatch(filled)
    expect(patch).toEqual({
      name: 'Acme',
      country: 'Netherlands',
      city: null,
      website: 'https://acme.example',
      description: null,
    })
    expect('status' in patch).toBe(false)
  })
})
