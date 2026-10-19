import { getActiveImpersonation } from '@/lib/auth/impersonation'
import { stopImpersonation } from '@/actions/impersonation'

/** Sticky bar shown only while impersonating. Exit posts to stopImpersonation. */
export async function ImpersonationBanner() {
  const active = await getActiveImpersonation()
  if (!active) return null

  return (
    <div className="flex shrink-0 items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <span>
        Viewing as <strong>{active.targetEmail}</strong> (impersonation)
      </span>
      <form
        action={async () => {
          'use server'
          // stopImpersonation redirects on success (throws NEXT_REDIRECT, which
          // must propagate). Surface a returned error instead of swallowing it.
          const res = await stopImpersonation()
          if (res?.error) throw new Error(res.error)
        }}
      >
        <button
          type="submit"
          className="rounded bg-amber-950/10 px-2 py-0.5 underline-offset-2 hover:underline"
        >
          Exit
        </button>
      </form>
    </div>
  )
}
