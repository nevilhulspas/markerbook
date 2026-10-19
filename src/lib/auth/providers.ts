import 'server-only'

/**
 * Whether Google sign-in is switched on in this Supabase project. Read from
 * the project's public auth settings, so a self-hosted install without a
 * Google OAuth client does not show a "Continue with Google" button that only
 * fails. Cached for five minutes; any error counts as "off".
 */
export async function isGoogleSignInEnabled(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return false
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/settings`, {
      headers: { apikey: key },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return false
    const settings = (await res.json()) as { external?: { google?: boolean } }
    return settings.external?.google === true
  } catch {
    return false
  }
}
