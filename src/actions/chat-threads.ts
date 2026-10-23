'use server'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/session'
import { userErrorMessage } from '@/lib/supabase/errors'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isOwnedPath } from '@/lib/supabase/storage-path'
import type { ChatThread, ChatMessageRow } from '@/lib/database.types'
import type { ThreadTail } from '@/lib/insights/thread-recovery'

export async function getThreads(): Promise<
  { data: ChatThread[]; error: null } | { data: null; error: string }
> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) return { data: null, error: authError ?? 'Not authenticated' }

  const { data, error } = await supabase
    .from('chat_threads')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    return {
      data: null,
      error: userErrorMessage('getThreads', error, 'Could not load your chats. Please try again.'),
    }
  }
  return { data: (data ?? []) as ChatThread[], error: null }
}

/**
 * The newest stored message's role and time, plus how many the thread holds.
 *
 * This is what the chat's dropped-answer wait asks for, every few seconds,
 * until the reply lands. `getThreadMessages` answers the same question but
 * costs an auth round-trip, the whole transcript including every tool payload,
 * and a fresh signed URL for every attachment — hundreds of times over one
 * wait. This reads one row and a count, and signs nothing. Ownership still
 * goes through RLS: a thread the caller does not own simply returns no row.
 */
export async function getThreadTail(
  threadId: string
): Promise<
  { data: ThreadTail; error: null } | { data: null; error: string }
> {
  const supabase = await createClient()

  const { data: thread } = await supabase
    .from('chat_threads')
    .select('id')
    .eq('id', threadId)
    .maybeSingle()

  if (!thread) return { data: null, error: 'Thread not found' }

  const { data, error, count } = await supabaseAdmin
    .from('chat_messages')
    .select('role, created_at', { count: 'exact' })
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    return {
      data: null,
      error: userErrorMessage(
        'getThreadTail',
        error,
        'Could not load this chat. Please try again.'
      ),
    }
  }

  const newest = (data ?? [])[0] as { role: string; created_at: string } | undefined
  return {
    data: {
      lastRole:
        newest?.role === 'user' || newest?.role === 'assistant' ? newest.role : null,
      lastStoredAt: newest?.created_at ?? null,
      total: count ?? 0,
    },
    error: null,
  }
}

export async function getThreadMessages(
  threadId: string
): Promise<
  { data: ChatMessageRow[]; error: null } | { data: null; error: string }
> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) return { data: null, error: authError ?? 'Not authenticated' }

  // Verify thread ownership via RLS
  const { data: thread } = await supabase
    .from('chat_threads')
    .select('id')
    .eq('id', threadId)
    .single()

  if (!thread) return { data: null, error: 'Thread not found' }

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })

  if (error) {
    return {
      data: null,
      error: userErrorMessage(
        'getThreadMessages',
        error,
        'Could not load this chat. Please try again.'
      ),
    }
  }

  // Sign all attachment URLs concurrently — independent across messages/files.
  // Signing uses the service role, so only paths inside the caller's own
  // folder are signed: a stored attachment row is client-supplied data.
  const rows = (data ?? []) as ChatMessageRow[]
  await Promise.all(
    rows.flatMap((row) =>
      (row.attachments ?? []).map(async (att) => {
        if (!isOwnedPath(user.id, att.storagePath)) return
        const { data: signed } = await supabaseAdmin.storage
          .from('lab-pdfs')
          .createSignedUrl(att.storagePath, 3600)
        att.url = signed?.signedUrl
      })
    )
  )
  return { data: rows, error: null }
}

export async function createThread(): Promise<
  { data: ChatThread; error: null } | { data: null; error: string }
> {
  const { user, authError } = await getSessionUser()

  if (!user) return { data: null, error: authError ?? 'Not authenticated' }

  const { data, error } = await supabaseAdmin
    .from('chat_threads')
    .insert({ user_id: user.id })
    .select()
    .single()

  if (error) {
    return {
      data: null,
      error: userErrorMessage(
        'createThread',
        error,
        'Could not start a new chat. Please try again.'
      ),
    }
  }
  return { data: data as ChatThread, error: null }
}

export async function updateThreadTitle(
  threadId: string,
  title: string
): Promise<{ error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) return { error: authError ?? 'Not authenticated' }

  // Verify ownership
  const { data: thread } = await supabase
    .from('chat_threads')
    .select('id')
    .eq('id', threadId)
    .single()

  if (!thread) return { error: 'Thread not found' }

  const { error } = await supabaseAdmin
    .from('chat_threads')
    .update({ title })
    .eq('id', threadId)

  return { error: error?.message ?? null }
}

export async function deleteThread(
  threadId: string
): Promise<{ error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) return { error: authError ?? 'Not authenticated' }

  // Verify ownership
  const { data: thread } = await supabase
    .from('chat_threads')
    .select('id')
    .eq('id', threadId)
    .single()

  if (!thread) return { error: 'Thread not found' }

  const { error } = await supabaseAdmin
    .from('chat_threads')
    .delete()
    .eq('id', threadId)

  return { error: error?.message ?? null }
}
