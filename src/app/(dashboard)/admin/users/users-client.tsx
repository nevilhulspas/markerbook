'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  setImpersonatable,
  startImpersonation,
  type ImpersonationUser,
} from '@/actions/impersonation'
import { CONSENT_ONLY_BY_USER } from '@/lib/auth/impersonation-guards'

export function UsersClient({
  users,
  currentAdminId,
}: {
  users: ImpersonationUser[]
  currentAdminId: string
}) {
  const [rows, setRows] = useState(users)
  const [pending, startTransition] = useTransition()

  function toggle(userId: string, value: boolean) {
    setRows((prev) => prev.map((u) => (u.id === userId ? { ...u, impersonatable: value } : u)))
    startTransition(async () => {
      const { error } = await setImpersonatable(userId, value)
      if (error) {
        setRows((prev) => prev.map((u) => (u.id === userId ? { ...u, impersonatable: !value } : u)))
        toast.error(error)
      }
    })
  }

  function impersonate(userId: string) {
    startTransition(async () => {
      const res = await startImpersonation(userId)
      if (res?.error) toast.error(res.error)
    })
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-2 text-left font-medium">Email</th>
            <th className="px-4 py-2 text-left font-medium">Role</th>
            <th className="px-4 py-2 text-left font-medium">Allows sign-in as them</th>
            <th className="px-4 py-2 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => {
            const isSelf = u.id === currentAdminId
            const isAdmin = u.role === 'admin'
            return (
              <tr key={u.id} className="border-b last:border-0">
                <td className="px-4 py-2">{u.email}{isSelf && ' (you)'}</td>
                <td className="px-4 py-2 capitalize">{u.role}</td>
                <td className="px-4 py-2">
                  <Switch
                    checked={u.impersonatable}
                    // The admin can only withdraw consent; the user gives it
                    // on their own profile page.
                    disabled={pending || isSelf || isAdmin || !u.impersonatable}
                    title={u.impersonatable ? undefined : CONSENT_ONLY_BY_USER}
                    onCheckedChange={(v) => toggle(u.id, v)}
                    aria-label={`Toggle impersonatable for ${u.email}`}
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  {!isSelf && !isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending || !u.impersonatable}
                      onClick={() => impersonate(u.id)}
                    >
                      Impersonate
                    </Button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
