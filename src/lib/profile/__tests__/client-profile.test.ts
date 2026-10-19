import { describe, it, expect } from 'vitest'

import type { Profile } from '@/lib/database.types'
import { toClientProfile } from '../client-profile'

describe('toClientProfile', () => {
  it('drops the Shortcut token and keeps everything else', () => {
    const row = { id: 'u1', sex: 'male', nutrition_log_token: 'secret' } as unknown as Profile
    const out = toClientProfile(row)
    expect(out).toEqual({ id: 'u1', sex: 'male' })
    expect(JSON.stringify(out)).not.toContain('secret')
  })

  it('passes null through', () => {
    expect(toClientProfile(null)).toBeNull()
  })
})
