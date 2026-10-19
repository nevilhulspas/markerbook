/**
 * Capacitor environment helpers. Safe to import from both client and
 * server components — the underlying `@capacitor/core` runtime detection
 * gracefully no-ops outside the WKWebView, but we keep this module small
 * and side-effect-free so it doesn't bloat the server bundle.
 */

import { Capacitor } from '@capacitor/core'

/**
 * Custom URL scheme registered in `ios/App/App/Info.plist`. OAuth providers
 * (via Supabase) deep-link back to `${NATIVE_URL_SCHEME}://auth/callback`,
 * which iOS routes to the app instead of Safari. Must match the
 * `CFBundleURLSchemes` entry exactly, and be added to Supabase Auth →
 * URL Configuration → Redirect URLs.
 */
export const NATIVE_URL_SCHEME = 'nl.naturalheroes.bloodmarkers'

export const NATIVE_AUTH_CALLBACK_URL = `${NATIVE_URL_SCHEME}://auth/callback`

/**
 * Deep-link host sent by the native "Log Food by Voice" App Shortcut
 * (`ios/App/App/AppShortcuts.swift`). `CapacitorBridge` routes it to the
 * nutrition Quick Add with the voice recorder auto-started.
 */
export const NATIVE_RECORD_HOST = 'record'

/**
 * Deep-link host sent by the native "Log Food → Photo" App Shortcut.
 * `CapacitorBridge` routes it to the focused photo-capture screen with the
 * camera auto-opened.
 */
export const NATIVE_PHOTO_HOST = 'photo'

/**
 * True when running inside the Capacitor native shell (iOS WKWebView or
 * Android WebView), false in a regular browser. Use this to branch auth
 * flows that need deep linking instead of HTTP redirects.
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform()
}
