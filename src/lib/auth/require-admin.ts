import 'server-only'

import { getRequestUser } from '@/lib/supabase/request-user'

export type AdminUser = {
  id: string
  email: string
  app_metadata: { role: string }
}

export async function requireAdmin(): Promise<AdminUser> {
  const {
    data: { user },
    error,
  } = await getRequestUser()

  if (error || !user) {
    throw new Error('Not authenticated')
  }

  if (user.app_metadata?.role !== 'admin') {
    throw new Error('Not authorized: admin role required')
  }

  return {
    id: user.id,
    email: user.email ?? '',
    app_metadata: user.app_metadata as { role: string },
  }
}
