import { describe, it, expect } from 'vitest'
import { canImpersonate, type ImpersonationTarget } from '../impersonation-guards'

const base: ImpersonationTarget = {
  id: 'target-1',
  email: 'user@test.com',
  role: 'user',
  impersonatable: true,
}

describe('canImpersonate', () => {
  it('allows a flagged non-admin target', () => {
    expect(canImpersonate(base, 'admin-1')).toEqual({ ok: true })
  })
  it('rejects impersonating yourself', () => {
    expect(canImpersonate({ ...base, id: 'admin-1' }, 'admin-1')).toEqual({
      ok: false,
      reason: 'You cannot impersonate yourself.',
    })
  })
  it('rejects an admin target', () => {
    expect(canImpersonate({ ...base, role: 'admin' }, 'admin-1').ok).toBe(false)
  })
  it('rejects a non-flagged target', () => {
    expect(canImpersonate({ ...base, impersonatable: false }, 'admin-1').ok).toBe(false)
  })
  it('rejects a target with no email', () => {
    expect(canImpersonate({ ...base, email: null }, 'admin-1').ok).toBe(false)
  })
})
