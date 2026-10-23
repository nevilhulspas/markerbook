---
description: Install Markerbook on this computer and start it (local database, keys, first admin account)
---

Set up Markerbook for the user on this computer. They may not be technical: tell them
what you do in plain words, one short line per step, and ask only what you cannot find out.

## 1. Check the tools

Run these and read the results yourself:

- `node -v` → must be 22 or newer (`.nvmrc` says 22).
- `docker info` → Docker must be running. If not, ask the user to start Docker Desktop.
- `supabase --version` → the Supabase CLI. If missing, ask before you install it
  (macOS: `brew install supabase/tap/supabase`; others: https://supabase.com/docs/guides/cli).

Install nothing without the user's OK.

## 2. Ask the two things you need

Ask in one message:

1. **Their e-mail address.** You make that account admin after they sign up (step 5).
2. **Their Anthropic API key** (https://console.anthropic.com → API keys) for the AI
   features. They may also leave it out and paste it into `.env.local` themselves later.

Never use an `ANTHROPIC_API_KEY` from your own environment: that is Claude Code's key,
not the user's.

## 3. Run the setup

```bash
npm run setup -- --yes --admin-email=<email> [--anthropic-key=<key>]
```

It installs packages, starts the local Supabase stack (schema and biomarker catalogue
included) and writes `.env.local`. The first run downloads Docker images and can take
several minutes: run it in the background and wait for it.

If it fails:

- **Port already in use** → another Supabase project runs. `supabase stop --project-id <name>`
  (find the name with `docker ps`), or ask the user.
- **"all predefined address pools have been fully subnetted"** → Docker has no free network
  range. The setup already retries on its own network `markerbook-net`; later starts
  need `supabase start --network-id markerbook-net`.

## 4. Start the app

Next.js gives environment variables priority over `.env.local`, and Claude Code may set
`ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL` in your shell. Start the app without them, in
the background:

```bash
env -u ANTHROPIC_API_KEY -u ANTHROPIC_BASE_URL npm run dev
```

Wait until it prints `Ready`, and note the port (3000, or the next free one).

## 5. Hand over

Tell the user, in this order:

1. Open `http://localhost:<port>/register` and sign up with the e-mail address from step 2.
   When they have, run `npm run make-admin` (it uses `ADMIN_EMAIL` from `.env.local`) and
   tell them to sign out and back in to see the **Admin** section. Signing up alone never
   grants admin.
2. Want example data first? After sign-up, run `npm run demo` for their account and tell
   them to open the Marker Grid.
3. Next: import a lab report under **Plan → Import**.

If the port is not 3000, also update `NEXT_PUBLIC_SITE_URL` in `.env.local`.

For running it on a server for real, point them to `docs/SELF_HOSTING.md`.
