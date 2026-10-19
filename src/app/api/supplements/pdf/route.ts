import { createClient } from '@/lib/supabase/server'
import { getScheduleSupplements } from '@/actions/supplements'
import { renderStackPdf } from '@/lib/supplements/stack-pdf'
import { appTodayISO } from '@/lib/dates/today'

export const runtime = 'nodejs'

export async function GET(request: Request): Promise<Response> {
  const mode = new URL(request.url).searchParams.get('mode')
  // Only the two schedule lists are exportable. Stopped is history and the
  // wishlist is not a schedule, so neither can be reached through this route.
  if (mode !== 'active' && mode !== 'upcoming') {
    return new Response('mode must be "active" or "upcoming"', { status: 400 })
  }

  // Check auth here rather than inferring it from the action's error text — a
  // reworded message would silently turn every logged-out request into a 500.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Not authenticated', { status: 401 })
  }

  const { data, error } = await getScheduleSupplements(mode)
  if (error || !data) {
    return new Response(error ?? 'Failed to load supplements', { status: 500 })
  }

  const today = appTodayISO()
  const buffer = await renderStackPdf(mode, data, today)

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="stack-${mode}-${today}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
