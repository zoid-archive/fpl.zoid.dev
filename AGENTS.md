# AGENTS.md — guidance for Amp agents working in this repo

## Show it working: portal + screenshot (always)

Whenever you start, restart, or verify the dev server — or make any change that
affects the UI — always finish by showing the user both:

1. **The portal URL.** Run `amp orb services ensure` (the dev server is declared
   in `.amp/services.yaml`) and share the returned HTTP(S) URL as a Markdown
   link with the title `amp-portal`, e.g.
   `[Portal](https://example.onamp.dev/ "amp-portal")`. Never share localhost or
   raw sandbox-host URLs.
2. **A screenshot of the app actually working.** Use `agent-browser` in the orb
   to open the portal URL, run `set viewport 1280 720 2` (2x so it is not
   blurry), wait for a real ready signal for this app (e.g. rows in the Results
   table, not just page load), save the capture under `.amp/in/artifacts/`,
   inspect it with the media viewing tool, and embed it inline as a Markdown
   image, e.g. `![app working](file:///workspace/.amp/in/artifacts/name.png)`.

Capture representative states (for this app: the Query editor and the populated
Results table), not just the top of the page.

## Environment quick facts

- Fresh orbs are prepared by `.agents/setup` (runs automatically): bun,
  `bun install --frozen-lockfile --ignore-scripts`, generated Prisma client,
  systemd-managed local Postgres with an `fpl` database, and a `.env` with the
  local `DATABASE_URL`. `.agents/resume` re-checks Postgres on orb resume.
- `--ignore-scripts` is intentional: `better-sqlite3` (transitive via
  `electric-sql`) cannot build against the orb's Node ABI and nothing in this
  repo loads it. Do not "fix" this by enabling install scripts or adding
  `trustedDependencies`.
- Test gate (same as CI): `bun run test` (`tsc --noEmit` + `next lint`).
- The Electric sync server (`localhost:5133`, see `app/initElectric.ts`) is not
  configured in orbs; SQL-over-SQLite and Strategy publishing to local Postgres
  work without it.
