# Bloodmarkers

A self-hosted tool to organise your own lab data. Upload your lab reports, and
the app reads the values with AI (Anthropic Claude), puts them in one place,
and shows how they change over time. You can ask an AI assistant questions
about your own data.

> **Not a medical device. Not medical advice.** Bloodmarkers organises data you
> already have. Its AI output can be wrong. Talk to a doctor about your health.
> The software comes without any warranty (see [LICENSE](LICENSE)).

## What it does

| Area | What you get |
|---|---|
| Blood tests | PDF or photo import with AI extraction, manual entry, a marker × date grid with reference ranges, unit conversion, PDF and CSV export |
| Other tests | Import and detail pages for DUTCH hormone tests, gut microbiome, DEXA, RMR, genetics (SNP files) and any other report |
| Insights chat | A chat over all of your data, with tools, memory, web search and document upload in the chat |
| Nutrition | Food log by text, voice or photo; Dutch NEVO food database and Open Food Facts; recipes |
| Supplements | Your stack with intake schedule and PDF export |
| Planning | A lab catalogue and a "next to test" list |
| Admin | Biomarker catalogue, reference ranges, lab catalogue tools, users |

An optional iOS shell (Capacitor) loads the web app from your own server.

## Run it yourself

You need Node 22+, a [Supabase](https://supabase.com) project (cloud or
self-hosted) and an [Anthropic API key](https://console.anthropic.com).
The full guide is in [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md). In short:

```bash
npm ci
cp .env.example .env.local        # fill in the values
supabase link --project-ref <your-project-ref>
supabase db push --include-seed   # schema + biomarker catalogue
npm run build && npm start
```

Or use the [Dockerfile](Dockerfile).

Each person who signs up gets their own private data (row-level security in
Postgres). Every AI request counts toward a per-user limit that you can set
(`AI_REQUESTS_PER_HOUR`, `AI_REQUESTS_PER_DAY`), because the AI costs go to
your API key.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript (strict)
- Supabase (Postgres with row-level security, Auth, Storage)
- Anthropic Claude via the Vercel AI SDK and `@anthropic-ai/sdk`
- Tailwind CSS 4 · shadcn/ui · Recharts · TanStack Table
- Capacitor 8 for the optional iOS shell
- Vitest

## Development

```bash
npm ci
cp .env.example .env.local
supabase start                    # local database with schema + seed
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run gen:types` | Regenerate database types from the linked Supabase project |

CI runs lint, typecheck, tests and a build on every pull request. See
[CONTRIBUTING.md](CONTRIBUTING.md) to help, and [SECURITY.md](SECURITY.md) to
report a vulnerability.

## Licence

[GNU Affero General Public License v3.0 or later](LICENSE). If you run a
modified version for other people, you must offer them its source code.
Third-party data and their terms are listed in [NOTICE](NOTICE).
