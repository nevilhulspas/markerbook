import type { CapacitorConfig } from '@capacitor/cli'

// Every iOS build names its own server and bundle ID: set CAPACITOR_SERVER_URL
// (your site) and CAPACITOR_APP_ID (your bundle ID, also set in Xcode) before
// `npx cap sync ios`. There is no default, so a build never points at someone
// else's server by accident. See docs/SELF_HOSTING.md, "The iOS app".
function requireEnv(name: 'CAPACITOR_SERVER_URL' | 'CAPACITOR_APP_ID'): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `${name} is not set. Set CAPACITOR_SERVER_URL and CAPACITOR_APP_ID before running \`npx cap\` (see docs/SELF_HOSTING.md).`
    )
  }
  return value
}

const serverUrl = requireEnv('CAPACITOR_SERVER_URL')

const config: CapacitorConfig = {
  appId: requireEnv('CAPACITOR_APP_ID'),
  appName: 'Markerbook',
  // For a remote-served wrap we don't bundle web assets in the IPA — the
  // shell loads `server.url` directly. `webDir` is still required by the
  // CLI; point it at a tiny placeholder folder so `cap sync` is happy.
  webDir: 'capacitor-web-placeholder',
  server: {
    // Set via env so the same repo can produce dev / staging / prod IPAs
    // without code changes. The native Log Food shortcut reads this value
    // from the bundled capacitor.config.json too.
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
