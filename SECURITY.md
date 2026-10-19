# Security

Bloodmarkers stores health data, so security problems matter.

## Report a vulnerability

Do **not** open a public issue. Use GitHub's private vulnerability reporting:
**Security → Report a vulnerability** on this repository.

Include what is affected, how to reproduce it, and what an attacker could do.
You get an answer within a week. There is no bug bounty: this is a
non-commercial project.

## Scope

In scope: this code and its default configuration. Out of scope: a specific
installation run by someone else (report to them), and the third-party
services the app calls (Supabase, Anthropic, OpenAI, Open Food Facts).

## For people who run an installation

- Keep `SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` out of
  the browser, the repository and your logs.
- Update regularly: `git pull`, `npm ci`, `supabase db push`, rebuild.
- Set the AI request limits (`AI_REQUESTS_PER_HOUR`, `AI_REQUESTS_PER_DAY`)
  if other people use your installation.
- Known limitation: the nutrition-logging token for the iPhone Shortcut is
  stored in plain text in `profiles.nutrition_log_token` and can also be sent
  as a `?token=` URL parameter, which may end up in server logs. Renew it on
  the profile page if you think it leaked.
