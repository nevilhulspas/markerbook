# iOS shell (Capacitor)

A thin native iOS shell that loads your deployed Markerbook web app in a
`WKWebView`. No web assets are bundled: the IPA is small and always shows the
latest deployed version. This folder only exists because the Capacitor CLI
needs a `webDir`.

## Server URL

Set via `CAPACITOR_SERVER_URL` (see `capacitor.config.ts`):

```bash
CAPACITOR_SERVER_URL="https://health.example.com" CAPACITOR_APP_ID="com.example.markerbook" npx cap sync ios
```

The host is added to `server.allowNavigation` automatically.

## Your own build

1. Open `ios/App/App.xcodeproj` in Xcode (Swift Package Manager, no workspace).
2. **App** target → **Signing & Capabilities**: pick your team and set your
   bundle ID (the same as `CAPACITOR_APP_ID`).
3. Change the URL scheme in `ios/App/App/Info.plist`, the deep links and log
   endpoint in `ios/App/App/AppShortcuts.swift`, and `NATIVE_URL_SCHEME` in
   `src/lib/capacitor.ts` to match. Add `<scheme>://auth/callback` to the
   Supabase Auth redirect URLs.
4. **Product → Archive → Distribute App**. The command-line steps are in
   `CLAUDE.md` ("Releasing a new TestFlight build").

## When you need a new build

Only the web app changed? No new build: testers relaunch the app. Build again
when the native side changes: the build number, a new Capacitor plugin, or
permissions in `Info.plist`.
