# Contributing

Thanks for helping. Bug reports, fixes and small improvements are welcome.

## Before you start

- For a bug, open an issue with the steps to reproduce it.
- For a new feature, open an issue first, so we can agree on the approach
  before you build it.
- Never put real health data in an issue, a test or a screenshot.

## Development setup

```bash
npm run setup           # tools check, local database with schema and catalogue, .env.local
npm run dev
npm run demo            # optional: made-up results for your account
```

AI features need an `ANTHROPIC_API_KEY`. Tests do not: they mock the AI.

## Pull requests

1. Branch from `main`, name it `<type>/<short-desc>` (e.g. `fix/grid-unit-toggle`).
2. Keep the change focused. One subject per pull request.
3. Add or update tests for behaviour you change.
4. All of these must pass:

   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

5. Write commit messages as [Conventional Commits](https://www.conventionalcommits.org):
   `feat: …`, `fix: …`, `docs: …`, `refactor: …`, `test: …`, `chore: …`.

## Database changes

- Add a new file in `supabase/migrations/` (`supabase migration new <name>`).
  Never edit a migration that is already on `main`.
- Write migrations so they can run twice (`if not exists`, `create or replace`).
- Every new table with user data needs row-level security and a policy that
  limits rows to `(select auth.uid())`.
- Run `npm run gen:types:local` (local stack after `supabase db reset`) or
  `npm run gen:types` (linked project) against a database with your migration,
  and commit the updated `src/lib/supabase/database.generated.ts`.

## Code conventions

Project conventions (page layout, charts, validation, the health-document
registry for new test types) are in [CLAUDE.md](CLAUDE.md). The short version:

- TypeScript strict; no `any`.
- Wrap pages in `<PageContainer>`.
- Chart colours as `var(--chart-N)`, never `hsl(var(--chart-N))`.
- A new indexable test type is one registry entry, not chat code
  (`src/lib/health-documents/registry.ts`).

## Licence

By contributing, you agree that your contribution is licensed under the
[AGPL-3.0-or-later](LICENSE), like the rest of the project.
