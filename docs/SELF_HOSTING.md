# Self-hosting Bloodmarkers

This guide sets up your own installation: one web app, one Supabase project,
your own AI keys. Plan about an hour.

> You run this for yourself (and, if you want, people you know). You are
> responsible for your installation, the data in it, and the AI costs on your
> keys. Bloodmarkers is not a medical device; see [NOTICE](../NOTICE).

## 1. What you need

- Node.js 22 or newer, and npm
- The [Supabase CLI](https://supabase.com/docs/guides/cli) (2.x)
- A Supabase project: [supabase.com](https://supabase.com) (pick an EU region
  if you are in the EU) or a [self-hosted Supabase](https://supabase.com/docs/guides/self-hosting)
- An [Anthropic API key](https://console.anthropic.com)
- Optional: an OpenAI API key, only for voice input in the nutrition log

## 2. Try it locally first (optional)

```bash
git clone <this repository> bloodmarkers
cd bloodmarkers
npm run setup
npm run dev
```

`npm run setup` checks your tools, starts a local Supabase stack with the schema and
the biomarker catalogue, and writes `.env.local`. With Claude Code, type `/setup`
instead. The steps below are for a real installation on a server.

## 3. Create the database

In your Supabase project:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push --include-seed
```

This creates all tables, access rules (row-level security), storage buckets,
and loads the shared biomarker catalogue from `supabase/seed.sql`.

Then fill in your settings, based on [.env.example](../.env.example). You find the
Supabase values under **Project Settings → API**. Set `ADMIN_EMAIL` to your own
address.

## 4. Set up sign-in (Supabase dashboard)

Under **Authentication → URL Configuration**:

1. Set **Site URL** to your `NEXT_PUBLIC_SITE_URL`.
2. Add `<NEXT_PUBLIC_SITE_URL>/auth/callback` to **Redirect URLs**.

Under **Authentication → Sign In / Providers**:

- Email sign-in works without more setup. Decide if you want e-mail
  confirmation on.
- Google sign-in is optional: add a Google OAuth client and enable the
  provider. The "Continue with Google" button only appears once it is enabled.

Anyone who can open your site can create an account. If you want a private
installation, turn off **Allow new users to sign up** after you created your
own account(s).

## 5. Run the app

Development:

```bash
npm run dev
```

Production, without Docker:

```bash
npm run build
npm start          # listens on port 3000
```

Production, with Docker:

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
  --build-arg NEXT_PUBLIC_SITE_URL=https://health.example.com \
  -t bloodmarkers .
docker run -p 3000:3000 --env-file .env.local bloodmarkers
```

Put a reverse proxy with HTTPS in front of it (Caddy, Traefik, nginx).

## 6. Make yourself admin

Sign up with the address in `ADMIN_EMAIL`. After you confirm your e-mail address,
that account is admin and the **Admin** section appears in the sidebar.

Without `ADMIN_EMAIL`, run `npm run make-admin -- you@example.com` with the
production settings in `.env.local`.

## 7. Optional data

The app works without these. They make marker matching and the food log better.

**LOINC (lab test codes).** Download the LOINC table from
[loinc.org](https://loinc.org/downloads/) (free account, accept their
licence), unzip it, then:

```bash
npx tsx scripts/loinc/import-loinc-terms.ts /path/to/Loinc.csv
```

`scripts/loinc/gen-loinc-display.ts` then writes short display names with the
AI (costs a little on your Anthropic key).

**NEVO (Dutch food database).** Download the NEVO CSV from
[RIVM](https://www.rivm.nl/en/dutch-food-composition-database) and accept the
conditions of use (no charging end users for NEVO data). Then:

```bash
npx tsx scripts/seed-nevo.ts /path/to/NEVO2025.csv            # dry run
npx tsx scripts/seed-nevo.ts /path/to/NEVO2025.csv --commit
```

**Lab catalogue.** Empty at the start. As admin, add a lab under
**Admin → Labs** and let the scraper read its public test list. The scraper
follows each site's `robots.txt`. Check the lab's terms before you collect
its prices.

## 8. Settings worth knowing

| Variable | Default | Effect |
|---|---|---|
| `AI_REQUESTS_PER_HOUR` / `AI_REQUESTS_PER_DAY` | 60 / 300 | AI requests per user. 0 switches a limit off. |
| `NEXT_PUBLIC_APP_TIME_ZONE` | Europe/Amsterdam | The calendar for "today". Set at build time. |
| `CONTACT_EMAIL` | site URL | Contact sent to Open Food Facts. |

## 9. Updating

```bash
git pull
npm ci
supabase db push      # applies new migrations, if any
npm run build && npm start
```

Your web host does not run database migrations for you. Run `supabase db push`
before you start the new version.

## 10. The iOS app (optional)

`ios/` holds a Capacitor shell that loads your web app. To build your own:

1. Set `CAPACITOR_SERVER_URL` to your site and `CAPACITOR_APP_ID` to your own
   bundle ID (e.g. `com.example.bloodmarkers`).
2. Open `ios/App/App.xcodeproj`, change the bundle ID, team and the URL scheme
   in `Info.plist` to match.
3. Run `npx cap sync ios` and build with Xcode.

## Privacy checklist

Health data is sensitive. Before you invite other people:

- Use HTTPS and a strong secret key; never expose `SUPABASE_SECRET_KEY`.
- Know where your data goes: Supabase (database and files), Anthropic (AI
  requests), OpenAI (voice only), Open Food Facts (food searches).
- In the EU, health data falls under GDPR article 9. Get explicit consent and
  tell people how they can export and delete their data.
- The "Admin access" switch on a user's profile lets the admin sign in as
  that user. Only the user can turn it on.
