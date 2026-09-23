#!/usr/bin/env ./node_modules/.bin/zx
import 'zx/globals'

import task from 'tasuku'

import arg from 'arg'
import { quiet } from 'zx'

const args = arg({
  '--clone': Boolean,
})
const clone = args['--clone'] || false

const FPL_DB_PATH = 'public/assets/fpl.db'
const SEASON = '2025-26'
const CSV_PATH = `Fantasy-Premier-League/data/${SEASON}/cleaned_players.csv`

await task('fetch Fantasy-Premier-League data', async () => {
  await $`rm -rf fpl.db`
  if (clone) {
    await $`rm -rf Fantasy-Premier-League`
    await $`git clone --depth 1 --filter=blob:none --sparse https://github.com/vaastav/Fantasy-Premier-League.git`
    await $`git -C Fantasy-Premier-League sparse-checkout set data/${SEASON}`
  }
})

await task('log cleaned_players.csv', async () => {
  await $`head -n 3 ${CSV_PATH}`
})

await task('sqlite - import csv data', async () => {
  // zx quotes interpolated args, so the redirect lives in the shell string.
  // `.import --csv --skip 1` keeps the header row out of the table and ignores
  // extra columns (value_per_m) that this app's schema does not use.
  const sql = `
.mode csv
CREATE TABLE players(
  "first_name" TEXT,
  "second_name" TEXT,
  "goals_scored" INTEGER,
  "assists" INTEGER,
  "total_points" INTEGER,
  "minutes" INTEGER,
  "goals_conceded" INTEGER,
  "creativity" FLOAT,
  "influence" FLOAT,
  "threat" FLOAT,
  "bonus" INTEGER,
  "bps" TEXT,
  "ict_index" FLOAT,
  "clean_sheets" INTEGER,
  "red_cards" INTEGER,
  "yellow_cards" INTEGER,
  "selected_by_percent" FLOAT,
  "now_cost" INTEGER,
  "element_type" TEXT
);
.import --csv --skip 1 ${CSV_PATH} players
`
  const sqlPath = 'fpl-import.sql'
  await fs.writeFile(sqlPath, sql)
  try {
    await quiet($`sh -c ${`sqlite3 fpl.db < ${sqlPath}`}`)
  } finally {
    await fs.rm(sqlPath, { force: true })
  }
})

await task('sqlite - replace db when players have changed', async () => {
  // Compare player rows only. sqldiff is not in the sqlite3 package on
  // GitHub-hosted runners, so dump both tables and diff the text.
  const dump = (path) =>
    quiet(
      $`sqlite3 ${path} ${`SELECT * FROM players ORDER BY first_name, second_name, total_points, minutes;`}`,
    )

  const next = await dump('fpl.db')
  const current = await dump(FPL_DB_PATH)

  if (next.stdout === current.stdout) {
    console.log('DB has not changed')
    await $`rm -f fpl.db`
    return
  }

  console.log('DB has changed, adding timestamp and moving the file')
  await $`sqlite3 fpl.db << EOF
CREATE TABLE meta(
  lastUpdated TEXT
);
INSERT INTO meta (lastUpdated) VALUES (CURRENT_TIMESTAMP);
EOF`
  await $`mv fpl.db ${FPL_DB_PATH}`
})
