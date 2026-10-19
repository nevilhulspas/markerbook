import { describe, it, expect } from 'vitest'

import { labSubmissionSchema } from '../lab'

describe('labSubmissionSchema', () => {
  it('accepts a valid submission and trims; blank optionals become undefined', () => {
    const r = labSubmissionSchema.safeParse({
      name: '  BODIMED ',
      website: 'https://bodimed.com',
      country: ' Bulgaria ',
      city: '',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.name).toBe('BODIMED')
      expect(r.data.website).toBe('https://bodimed.com')
      expect(r.data.country).toBe('Bulgaria')
      expect(r.data.city).toBeUndefined()
    }
  })

  it('rejects an empty / whitespace-only name', () => {
    expect(labSubmissionSchema.safeParse({ name: '   ', website: 'https://x.com' }).success).toBe(false)
  })

  it('rejects a missing, non-URL, or non-http(s) website', () => {
    expect(labSubmissionSchema.safeParse({ name: 'X', website: '' }).success).toBe(false)
    expect(labSubmissionSchema.safeParse({ name: 'X', website: 'notaurl' }).success).toBe(false)
    expect(labSubmissionSchema.safeParse({ name: 'X', website: 'ftp://x.com' }).success).toBe(false)
    expect(labSubmissionSchema.safeParse({ name: 'X', website: 'javascript:alert(1)' }).success).toBe(false)
  })

  it('accepts http and https', () => {
    expect(labSubmissionSchema.safeParse({ name: 'X', website: 'http://x.com' }).success).toBe(true)
    expect(labSubmissionSchema.safeParse({ name: 'X', website: 'https://x.com/tests' }).success).toBe(true)
  })
})
