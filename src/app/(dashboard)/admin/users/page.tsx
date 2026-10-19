import type { Metadata } from 'next'

import { listImpersonationUsers } from '@/actions/impersonation'
import { requireAdmin } from '@/lib/auth/require-admin'
import { UsersClient } from './users-client'

export const metadata: Metadata = { title: 'Users | Admin' }

export default async function AdminUsersPage() {
  const admin = await requireAdmin()
  const { data: users, error } = await listImpersonationUsers()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground">
          Toggle which accounts can be impersonated, then switch in to test as them.
        </p>
      </div>
      {error ? (
        <p className="text-destructive">Failed to load users: {error}</p>
      ) : (
        <UsersClient users={users ?? []} currentAdminId={admin.id} />
      )}
    </div>
  )
}
