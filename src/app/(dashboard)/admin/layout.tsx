import { redirect } from 'next/navigation'
import { getRequestUser } from '@/lib/supabase/request-user'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: { user } } = await getRequestUser()

  if (!user || user.app_metadata?.role !== 'admin') {
    redirect('/dashboard')
  }

  return <>{children}</>
}
