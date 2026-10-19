# CLAUDE.md

Project conventions for this Next.js + Supabase blood markers app. They apply to people and to AI coding assistants working in this repo.

## First-time setup

If the user asks to install, set up or run Markerbook on a new machine, follow
[.claude/commands/setup.md](.claude/commands/setup.md) (the `/setup` command). Short
version: `npm run setup -- --yes --admin-email=<their e-mail> [--anthropic-key=<their key>]`,
then start the app with `env -u ANTHROPIC_API_KEY -u ANTHROPIC_BASE_URL npm run dev`,
because Claude Code's own Anthropic variables would otherwise override `.env.local`.

## Git workflow

PRs target `main` directly. Branch as `<type>/<short-desc>` (e.g. `feat/sibo-import`). The required gate is the CI job (`lint · typecheck · test · build`). See [CONTRIBUTING.md](CONTRIBUTING.md).

## Page layout

Wrap page content in `<PageContainer>` ([src/components/layout/page-container.tsx](src/components/layout/page-container.tsx)) and pick a `width` mode:

- **`default`** — full width inside the dashboard `<main>`. Use for tables, dashboards, multi-column layouts.
- **`narrow`** — centered, capped at `lg:max-w-[50%]`. Use for detail/reading pages where wide content sprawls (e.g. a single-test detail with charts and notes).
- **`wide`** — centered, capped at `max-w-6xl`. Use for detail pages that still carry a dense table or wide chart and need more room than `narrow` (e.g. the microbiome taxa table).

```tsx
import { PageContainer } from '@/components/layout/page-container'

export default function Page() {
  return (
    <PageContainer width="narrow" className="space-y-6">
      {/* page content */}
    </PageContainer>
  )
}
```

Below the `lg` breakpoint the narrow mode falls back to full width — never hardcode widths on pages.

## Charts (Recharts via shadcn `<ChartContainer>`)

Globals define chart colors as `--chart-1`…`--chart-5` in `oklch(...)`. Reference them as `var(--chart-N)` — **never** wrap in `hsl()` (e.g. `hsl(var(--chart-1))` produces `hsl(oklch(...))`, an invalid color, and the line renders invisibly).

## Env vars

- Supabase secret key uses the new naming: `SUPABASE_SECRET_KEY` (not `SUPABASE_SERVICE_ROLE_KEY`). Read in [src/lib/supabase/admin.ts](src/lib/supabase/admin.ts).
- `ANTHROPIC_API_KEY` is required for `/api/interpret`, `/api/chat`, `/api/catalog/describe`, `/api/insights-chat`, and `src/actions/pdf-import.ts`.

## Validation

Optional UUID form fields must allow empty strings — use a `preprocess` to coerce `''` → `undefined` before the uuid check (see [src/lib/validations/biomarker.ts](src/lib/validations/biomarker.ts)). `.optional()` alone won't pass empty strings through `z.string().uuid()`.

## In-chat document indexing (health-document registry)

Indexable health documents (blood, microbiome, DUTCH, DEXA) share one registry:
[src/lib/health-documents/registry.ts](src/lib/health-documents/registry.ts). The insights
chat upload/indexing iterates this registry and has **no per-type branching** — so adding a
new test type automatically extends in-chat upload + "log it" indexing.

**To add a new indexable type (e.g. a SIBO breath test):**

1. Build (or reuse) the import page's two pure pieces, kept free of upload/auth side effects
   so both the page and the registry can call them:
   - a `parse<Type>Bytes(bytes, mediaType, …)` helper in `src/lib/<type>/parse.ts` that turns
     uploaded bytes into your extraction shape (the Anthropic call + Zod validation), and
   - a `persist` path — either a server action that takes the extraction directly (like
     `saveMicrobiomeReport`) or a pure `…ExtractionToValues` mapper in
     [src/lib/health-documents/mappers.ts](src/lib/health-documents/mappers.ts) feeding an
     existing `create…` action.
2. Add a `HealthDocumentType` entry in `src/lib/health-documents/entries/<type>.ts` wiring
   `parse`, `summarize`, and `persist` (returning `{ recordId, href }` to the detail page),
   and register it in `registry.ts` (`HEALTH_DOCUMENT_TYPES`).
3. Add `'<type>'` to `HealthDocumentTypeId` in
   [src/lib/health-documents/types.ts](src/lib/health-documents/types.ts).

That is the whole change — the chat route, tools, confirm card, and upload flow pick it up
with no edits. Add a registry test asserting the new id is present.

Example: a SIBO breath test (`id: 'sibo'`, `label: 'SIBO breath test'`, classifierHint about
hydrogen/methane ppm over time) would create `src/lib/sibo/parse.ts` +
`src/lib/health-documents/entries/sibo.ts`, register it, and immediately be uploadable and
loggable in chat.

## iOS / Capacitor

The repo wraps the same Next.js web app as an iOS app via Capacitor 8 + Swift Package Manager. The IPA is a thin shell that loads the web app remotely from `CAPACITOR_SERVER_URL` (see [capacitor.config.ts](capacitor.config.ts)). Web changes ship with a normal deploy; **anything in `ios/` or any change to a native plugin needs a new App Store / TestFlight build**.

The bundle ID and URL scheme in `ios/` (`nl.naturalheroes.bloodmarkers`, also `NATIVE_URL_SCHEME` in `src/lib/capacitor.ts`) belong to the original author's build. To ship your own app, change them together with `CAPACITOR_APP_ID`, the team in Xcode, and the redirect URL in Supabase Auth (`<scheme>://auth/callback`). See [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

### Releasing a new TestFlight build

Always run from the repo root.

```bash
# 1. Make sure Capacitor's gitignored runtime files exist (capacitor.config.json, config.xml, public/)
npx cap sync ios

# 2. Bump the build number (CURRENT_PROJECT_VERSION in pbxproj). Info.plist reads it via
#    $(CURRENT_PROJECT_VERSION); agvtool overwrites that with a literal, so restore it.
( cd ios/App && xcrun agvtool next-version -all ) && git checkout -- ios/App/App/Info.plist

# 3. Archive (the project has NO .xcworkspace — use -project)
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/ios/App.xcarchive \
  -allowProvisioningUpdates \
  -skipPackagePluginValidation \
  -skipMacroValidation \
  clean archive

# 4. Export to .ipa (signing config in ios/App/ExportOptions.plist). Needs an
#    App Store Connect API key: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (.p8 file).
xcodebuild -exportArchive \
  -archivePath build/ios/App.xcarchive \
  -exportPath build/ios/export \
  -exportOptionsPlist ios/App/ExportOptions.plist \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"

# 5. Upload to TestFlight
xcrun altool --upload-app -t ios \
  -f build/ios/export/App.ipa \
  --apiKey "$ASC_KEY_ID" \
  --apiIssuer "$ASC_ISSUER_ID"
```

After upload Apple processes the build for ~10–20 min before TestFlight makes it installable.

### Common gotchas

- **`ios/App/App.xcworkspace` does not exist** — Capacitor 8 with SPM only uses `App.xcodeproj`. Always pass `-project ios/App/App.xcodeproj` to `xcodebuild`. Older Capacitor (CocoaPods) used a workspace; that's gone.
- **`** ARCHIVE FAILED **` complaining about missing `config.xml`, `public/`, or `capacitor.config.json`** — these are gitignored generated files (see [ios/.gitignore](ios/.gitignore)). Re-run `npx cap sync ios`.
- **Adding a Capacitor plugin (`@capacitor/app`, `@capacitor/browser`, etc.)** — must run `npx cap sync ios` so the CLI regenerates [ios/App/CapApp-SPM/Package.swift](ios/App/CapApp-SPM/Package.swift) to include the new SPM dependency. Then archive a new build — web-only deploys won't expose the native side of the plugin and any call to it from JS will throw "plugin not implemented".
- **Native plugin needed but build is stale** — symptom on TestFlight is that the JS handler runs (button flickers as `isLoading` toggles) but immediately rejects, because the JS shim can't reach a native plugin that isn't in the IPA. Fix is a new TestFlight build (steps above).
