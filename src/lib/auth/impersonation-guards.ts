export interface ImpersonationTarget {
  id: string
  email: string | null
  role: string
  impersonatable: boolean
}

export type GuardResult = { ok: true } | { ok: false; reason: string }

/** Whether `callerId` (an admin) may impersonate `target`. Pure. */
export function canImpersonate(target: ImpersonationTarget, callerId: string): GuardResult {
  if (target.id === callerId) return { ok: false, reason: 'You cannot impersonate yourself.' }
  if (target.role === 'admin') return { ok: false, reason: 'Admins cannot be impersonated.' }
  if (!target.impersonatable) return { ok: false, reason: 'This user is not marked impersonatable.' }
  if (!target.email) return { ok: false, reason: 'This user has no email to switch into.' }
  return { ok: true }
}

/** Returned when an admin tries to turn on someone else's consent. */
export const CONSENT_ONLY_BY_USER = 'Only the user can allow this, from their profile page.'
