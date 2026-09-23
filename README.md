# Introduction FPL.lol

Build a FPL team by using SQL over official Fantasy Premier League current-season data and pinned [Vaastav archives](https://github.com/vaastav/Fantasy-Premier-League).

Try it out here, [FPL.lol](https://fpl.lol)

# How it works

- A [script](/scripts/getLatestFPLDatabase.mjs) converts the official API snapshot and archived CSVs to SQLite.
- SQLite + WASM to explore FPL data
- Publish SQL strategies to Postgres and share `/strategy/<id>` links.

# Seasons

The season selector sets `players`, a compatibility view with the original columns.
`player_seasons` contains every bundled season and a `season` column; the selector
never filters it. `seasons` records status, source revision/date, import time and
schema version. `meta.lastUpdated` remains the selected season's import time.
Selection is shareable as `?season=2025-26`; switching preserves draft edits and
reruns only the last executed SQL. Each execution is an isolated in-memory session;
writes in exploratory SQL do not persist between executions.

```sql
SELECT season, COUNT(*) AS players, MAX(total_points) AS highest_score
FROM player_seasons
GROUP BY season
ORDER BY season DESC;
```

These are cumulative snapshots, not gameweek histories. Partial and completed
season totals are not like-for-like, and scoring rules may differ. Prices remain
in tenths of £1m; ownership and prices are snapshot values. Missing historical
metrics are NULL. Player names are not identifiers for cross-season joins.

`scripts/seasons.json` explicitly configures the current season and supported
archives. Completed seasons are pinned to a source commit; change that pin to
import a correction. Run `bun scripts/getLatestFPLDatabase.mjs` to validate and
rebuild `public/assets/fpl.db` and `app/data/fpl.json` together. The existing
`--clone` invocation is also accepted. Unchanged data does not rewrite artifacts.
The hourly workflow commits both artifacts. For rollover, add and validate the new
season, pin the completed season, then change `currentSeason`; never infer it from
the calendar. Source revision dates are not claims of gameweek coverage or freshness.

## Current-season refresh

GitHub Actions fetches [bootstrap-static](https://fantasy.premierleague.com/api/bootstrap-static/)
once per hourly run under normal conditions. Vercel only builds/serves the committed
SQLite and manifest; it performs no refresh writes. Visitors query SQLite locally,
not the FPL API. A changed bundle needs a deployment to reach visitors; verify the
Vercel Git integration accepts the workflow's bot commits before relying on automatic
production refreshes. Scheduled Actions can be delayed, so this is not a live feed.

The public endpoint currently needs no authentication, but has no established
supported developer quota or SLA. Requests time out after 30 seconds; network
errors, HTTP 429 and 5xx receive at most three total attempts, with 2s/4s backoff
or the longer Retry-After (maximum 60s per wait). Access denials are not bypassed.
Invalid responses, season mismatch or exhausted retries fail the job before
publication, retaining the last good bundle without silently substituting CSVs.
Public accessibility is not a redistribution licence: the Premier League's
[Terms of Use](https://www.premierleague.com/en/terms-and-conditions) restrict database
creation/reuse and redistribution. Confirm appropriate permission before public
distribution; this implementation does not establish that permission.

`seasons.json` requires an explicit `official` current source and full commit pins
for `github` archives. The importer checks the API static-content URL's season
marker and event deadline years against the catalog. Missing or changed season
evidence fails closed. At rollover, validate and pin the outgoing archive first;
if no suitable archive exists, retain the last good bundle rather than relabeling
the new API season as the old one. No automatic calendar-based rollover occurs.

Existing player columns/units are unchanged, including textual `bps`, percentage
ownership (42.2, not 0.422), prices in tenths of £1m, and `GKP` mapped to `GK`.
Official IDs are used only for validation and stable ordering, not cross-season joins.
The additive `seasons` metadata schema is version 2:

- `source` / `source_url`: official API or GitHub archive attribution.
- `source_revision`: semantic rows+coverage hash for the API; commit for archives.
- `source_updated_at`: NULL for the API (no reliable global update timestamp).
- `captured_at`: API fetch time of the published snapshot, not the latest check.
- `data_changed_at`: when changed normalized player data was first observed locally.
- `coverage`: JSON event IDs with finished/checked/current/next flags from the API.
- `imported_at` / `meta.lastUpdated`: import time of that season's published revision.

The manifest exposes corresponding camelCase fields. Every successful validated
API check is logged with its time in the Actions run summary, even on no-ops.
Checks alone do not change artifacts or cache keys. Changed player data or coverage
publishes a revision; coverage-only changes preserve `data_changed_at`. The UI's
finished/checked counts describe API flags, not a guarantee that all totals are final.
Price and ownership changes also count as player-data changes.

To roll back, restore the importer/catalog/UI and matching bundle+manifest from
one known-good Git revision together through normal review/deployment. Do not mix
a newer manifest with older SQLite bytes. Disable scheduled refreshes first if
needed so an unwanted version is not regenerated. Rollback/deployment changes to
shared infrastructure require approval.

Published strategies default to the displayed season, with an explicit “Always
current season” option. Existing strategies keep their current-season behavior.
Pinning a season does not freeze results; dataset revisions are not retained.
Strategies are read and written through Prisma/Postgres; the UI no longer requires
Electric sync. Legacy Electric generation files are not used by this UI.

## Database migration before deployment

No shared database is migrated automatically. For an existing database with the
original Strategy table and no Prisma migration history, first baseline it with
`bunx prisma migrate resolve --applied 20240426000000_strategy`, then run
`bunx prisma migrate deploy`. For a new empty database, run only `migrate deploy`.
Generate the client with `bunx prisma generate`. These commands require approval
before use against shared/production data. Orb-local setup continues to use
`prisma db push` against its disposable database.

`bun run test` covers normalized imports, isolated season sessions and binding
semantics, followed by TypeScript and ESLint checks.

# Made with Love

Check out [TrackFootball.app](https://trackfootball.app), it is a social network for casual Football players.
