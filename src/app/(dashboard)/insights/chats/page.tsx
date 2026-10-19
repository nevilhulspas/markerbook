import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { getThreads } from '@/actions/chat-threads'
import { PageContainer } from '@/components/layout/page-container'
import { ChatsList } from '@/components/insights/chats-list'
import { throwIfAuthOutage } from '@/lib/supabase/auth-outage'
import { getRequestUser } from '@/lib/supabase/request-user'

export const metadata: Metadata = {
  title: 'Conversations | Bloodmarkers',
}

export default async function ChatsPage() {
  const {
    data: { user },
    error: authError,
  } = await getRequestUser()
  throwIfAuthOutage(user, authError)
  if (!user) redirect('/login')

  const { data: threads } = await getThreads()

  return (
    <PageContainer width="narrow" className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/insights"
          className="flex size-8 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Back to chat"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-xl font-semibold">Conversations</h1>
      </div>
      <ChatsList threads={threads ?? []} />
    </PageContainer>
  )
}
