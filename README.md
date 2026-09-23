# Introduction FPL.lol

Build a FPL team by using SQL over FPL (Fantasy Premier League) data from https://github.com/vaastav/Fantasy-Premier-League.

Try it out here, [FPL.lol](https://fpl.lol)

# How it works

- A [script](/scripts/getLatestFPLDatabase.mjs) to automatically convert FPL data CSVs to SQLite.
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
