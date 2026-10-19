import type { CapacitorConfig } from '@capacitor/cli'

// Self-hosters building their own iOS shell set CAPACITOR_APP_ID and
// CAPACITOR_SERVER_URL (and change the bundle ID in Xcode to match).
const serverUrl = process.env.CAPACITOR_SERVER_URL ?? 'https://bloodmarkers.naturalheroes.nl'

const config: CapacitorConfig = {
  appId: process.env.CAPACITOR_APP_ID ?? 'nl.naturalheroes.bloodmarkers',
  appName: 'Blood Markers',
  // For a remote-served wrap we don't bundle web assets in the IPA — the
  // shell loads `server.url` directly. `webDir` is still required by the
  // CLI; point it at a tiny placeholder folder so `cap sync` is happy.
  webDir: 'capacitor-web-placeholder',
  server: {
    // Set via env so the same repo can produce dev / staging / prod IPAs
    // without code changes. Falls back to the production Dokploy URL.
    url: serverUrl,
    // Wait for the URL to load instead of showing a blank screen on slow nets.
    androidScheme: 'https',
    iosScheme: 'https',
    // Allow the Next.js app to call its own API routes from inside the
    // webview. Add any extra hosts (Supabase, Anthropic, etc.) here.
    allowNavigation: [
      new URL(serverUrl).host,
      '*.supabase.co',
      'api.anthropic.com',
    ],
  },
  ios: {
    // Edge-to-edge: let the web content fill the whole WebView (including under
    // the notch / home indicator) and handle safe areas itself via
    // viewport-fit=cover + env(safe-area-inset-*) padding. The previous 'always'
    // made the native shell inset the content (dark bars top/bottom) and offset
    // touch hit-testing from the rendered content. Requires a fresh TestFlight
    // build to take effect.
    contentInset: 'never',
    // Allows the WKWebView to navigate to domains beyond the App Bound
    // Domains list. Required because the remote-served app calls
    // Supabase, Anthropic, and other third-party hosts that aren't
    // declared in WKAppBoundDomains. Cookie persistence is handled
    // separately by Supabase's Max-Age cookie settings (see
    // src/lib/supabase/client.ts).
    limitsNavigationsToAppBoundDomains: false,
  },
}

export default config
