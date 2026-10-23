/**
 * "Stop this answer" — the deliberate half of a cancelled run.
 *
 * The chat's Stop button aborts the browser's own request, which the server
 * cannot distinguish from a phone losing signal — and by design it must not,
 * because a dropped connection has to leave the run alone so the answer
 * survives. So Stop also posts here, and this is what actually ends
 * the run.
 */
import { createClient } from '@/lib/supabase/server'
import { stopRun } from '@/lib/insights/run-registry'

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return new Response('Unauthorized', { status: 401 })

  const { threadId } = (await request.json()) as { threadId?: string }
  if (!threadId) return new Response('threadId required', { status: 400 })

  // Ownership goes through RLS: someone else's thread simply has no row, so a
  // stop can never reach a run that is not the caller's.
  const { data: thread } = await supabase
    .from('chat_threads')
    .select('id')
    .eq('id', threadId)
    .maybeSingle()

  if (!thread) return new Response('Thread not found', { status: 404 })

  // A stop that finds nothing is ordinary, not an error: the answer may have
  // finished in the moment between the click and this request.
  const stopped = stopRun(threadId)
  console.log('[insights-chat] stop requested', { threadId, stopped })

  return Response.json({ stopped })
}
