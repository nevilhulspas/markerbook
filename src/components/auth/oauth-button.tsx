'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { signInWithGoogle } from '@/actions/auth'
import { createClient } from '@/lib/supabase/client'
import {
  isNativePlatform,
  NATIVE_AUTH_CALLBACK_URL,
} from '@/lib/capacitor'
import { Button } from '@/components/ui/button'

/**
 * On the web this calls the existing server action, which redirects the
 * page to Google's OAuth consent screen. On native (Capacitor), Google
 * blocks OAuth inside WKWebViews and a normal browser redirect would
 * complete the session in Safari instead of the app — so we route through
 * `ASWebAuthenticationSession` (via `@capacitor/browser`) with a
 * custom-scheme `redirectTo`, then exchange the code inside the app's
 * webview via `CapacitorBridge`.
 *
 * `onFinished` runs when the auth-session overlay closes for any reason
 * (user cancel, programmatic `Browser.close()` from `CapacitorBridge`
 * after a successful redirect, or an error). The button uses it to clear
 * its loading state so the user isn't left with a permanently-disabled
 * spinner when they back out of the OAuth flow.
 */
async function startNativeGoogleSignIn(
  onFinished: () => void
): Promise<void> {
  const supabase = createClient()
  const { Browser } = await import('@capacitor/browser')

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: NATIVE_AUTH_CALLBACK_URL,
      skipBrowserRedirect: true,
    },
  })

  if (error) throw error
  if (!data.url) throw new Error('Supabase did not return an OAuth URL')

  // `browserFinished` fires both on user cancel and when CapacitorBridge
  // calls `Browser.close()` after a successful redirect. `Browser.open()`
  // itself resolves as soon as the overlay is presented, so without this
  // listener `isLoading` would never be cleared on cancel.
  const handle = await Browser.addListener('browserFinished', () => {
    onFinished()
    void handle.remove()
  })

  try {
    // `presentationStyle: 'popover'` maps to `ASWebAuthenticationSession`,
    // which shares cookies with Safari (so users stay signed in to Google)
    // and dismisses automatically when the custom-scheme redirect fires.
    await Browser.open({ url: data.url, presentationStyle: 'popover' })
  } catch (err) {
    void handle.remove()
    throw err
  }
}

export function OAuthButton({ next }: { next?: string }) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleGoogleSignIn() {
    setIsLoading(true)
    try {
      if (isNativePlatform()) {
        // The native flow clears its own loading state via the
        // `browserFinished` listener inside `startNativeGoogleSignIn`,
        // so don't reset it on the happy path here.
        await startNativeGoogleSignIn(() => setIsLoading(false))
        return
      }
      // On success the action redirects to Google; it only returns on failure.
      const result = await signInWithGoogle(next)
      if (result?.error) {
        toast.error(`Google sign-in failed — ${result.error}`)
        setIsLoading(false)
      }
    } catch {
      // No toast here: a redirect can surface as a throw, and that is success.
      setIsLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={handleGoogleSignIn}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <svg className="size-4" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
      )}
      Continue with Google
    </Button>
  )
}
