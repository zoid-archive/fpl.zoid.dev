#!/usr/bin/env bun
import { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  appendFile,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import config from './seasons.json' with { type: 'json' }
import { fetchOfficial, officialSnapshot, officialURL } from './officialFPL.mjs'

// Preserve the existing players columns and units. Missing optional historical
// metrics are NULL, never zero. Names are display text, not player identities.
export const columns = {
  first_name: 'TEXT',
  second_name: 'TEXT',
  goals_scored: 'INTEGER',
  assists: 'INTEGER',
  total_points: 'INTEGER',
  minutes: 'INTEGER',
  goals_conceded: 'INTEGER',
  creativity: 'REAL',
  influence: 'REAL',
  threat: 'REAL',
  bonus: 'INTEGER',
  bps: 'TEXT',
  ict_index: 'REAL',
  clean_sheets: 'INTEGER',
  red_cards: 'INTEGER',
  yellow_cards: 'INTEGER',
  selected_by_percent: 'REAL',
  now_cost: 'INTEGER',
  element_type: 'TEXT',
}
const required = [
  'first_name',
  'second_name',
  'total_points',
  'minutes',
  'now_cost',
  'element_type',
]

export function normalizePlayers(rows, headers) {
  for (const name of required) {
    if (!headers.includes(name))
      throw new Error(`Missing required column: ${name}`)
  }
  if (!rows.length) throw new Error('Empty season dataset')
  return rows.map((row) =>
    Object.entries(columns).map(([name, type]) => {
      const raw = row[name]
      if (raw == null || raw === '') {
        if (required.includes(name)) throw new Error(`Missing value: ${name}`)
        return null
      }
      if (
        name === 'element_type' &&
        !['GK', 'DEF', 'MID', 'FWD', 'AM'].includes(raw)
      ) {
        throw new Error(`Invalid position: ${raw}`)
      }
      if (type === 'TEXT' && name !== 'bps') return raw
      const value = Number(raw)
      if (
        !Number.isFinite(value) ||
        ((type === 'INTEGER' || name === 'bps') && !Number.isInteger(value))
      ) {
        throw new Error(`Invalid numeric value for ${name}: ${raw}`)
      }
      return name === 'bps' ? String(value) : value
    }),
  )
}

export async function buildDatabase({
  output = 'public/assets/fpl.db',
  manifestPath = 'app/data/fpl.json',
  catalog = config,
  loadOfficial = fetchOfficial,
  now = () => new Date().toISOString(),
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'fpl-import-'))
  const database = new Database(join(directory, 'next.db'))
  try {
    if (
      !catalog.seasons.some((entry) => entry.season === catalog.currentSeason)
    ) {
      throw new Error('Current season must be included in the catalog')
    }
    if (
      new Set(catalog.seasons.map((entry) => entry.season)).size !==
      catalog.seasons.length
    )
      throw new Error('Duplicate season')
    for (const entry of catalog.seasons) {
      if (entry.source === 'official') {
        if (
          entry.season !== catalog.currentSeason ||
          entry.status !== 'partial'
        )
          throw new Error('Official source must be the partial current season')
      } else if (
        entry.source !== 'github' ||
        !/^[a-f0-9]{40}$/.test(entry.sourceRef)
      ) {
        throw new Error('GitHub archives must use a pinned commit')
      }
    }
    database.exec(`CREATE TABLE player_seasons (season TEXT NOT NULL, ${Object.entries(
      columns,
    )
      .map(([name, type]) => `"${name}" ${type}`)
      .join(', ')});
      CREATE INDEX player_seasons_season ON player_seasons(season);
      CREATE TABLE seasons (season TEXT PRIMARY KEY, status TEXT NOT NULL, source_revision TEXT NOT NULL, source_updated_at TEXT, imported_at TEXT NOT NULL, schema_version INTEGER NOT NULL, source TEXT NOT NULL, source_url TEXT NOT NULL, captured_at TEXT, data_changed_at TEXT NOT NULL, coverage TEXT);
      CREATE TABLE meta (lastUpdated TEXT);`)
    let previous
    try {
      previous = JSON.parse(await readFile(manifestPath, 'utf8'))
    } catch {
      /* First build. */
    }
    const seasons = []
    for (const entry of catalog.seasons) {
      if (!/^\d{4}-\d{2}$/.test(entry.season)) throw new Error('Invalid season')
      let rows, sourceRevision, sourceUpdatedAt, coverage, capturedAt
      const sourceURL =
        entry.source === 'official'
          ? officialURL
          : 'https://github.com/vaastav/Fantasy-Premier-League'
      if (entry.source === 'official') {
        const snapshot = officialSnapshot(
          await loadOfficial(),
          entry.season,
          columns,
        )
        rows = normalizePlayers(snapshot.players, Object.keys(columns))
        coverage = snapshot.coverage
        capturedAt = now()
        sourceUpdatedAt = null
        sourceRevision = createHash('sha256')
          .update(JSON.stringify({ rows, coverage }))
          .digest('hex')
        const checked = `Official FPL checked successfully at ${capturedAt}: ${rows.length} players; ${coverage.events.filter((event) => event.finished).length} finished, ${coverage.events.filter((event) => event.dataChecked).length} checked gameweeks. This is a fetch time, not an upstream update time.`
        console.log(checked)
        if (process.env.GITHUB_STEP_SUMMARY)
          await appendFile(process.env.GITHUB_STEP_SUMMARY, `${checked}\n`)
      } else {
        const csvPath = `data/${entry.season}/cleaned_players.csv`
        // Fetch only the requested source revision; historical archives are pinned.
        const source = join(directory, entry.season)
        execFileSync('git', ['init', '-q', source])
        execFileSync('git', [
          '-C',
          source,
          'remote',
          'add',
          'origin',
          'https://github.com/vaastav/Fantasy-Premier-League.git',
        ])
        execFileSync('git', [
          '-C',
          source,
          'config',
          'remote.origin.promisor',
          'true',
        ])
        execFileSync('git', [
          '-C',
          source,
          'config',
          'remote.origin.partialclonefilter',
          'blob:none',
        ])
        execFileSync('git', [
          '-C',
          source,
          'fetch',
          '-q',
          '--depth=1',
          '--filter=blob:none',
          'origin',
          entry.sourceRef,
        ])
        const git = (...args) =>
          execFileSync('git', ['-C', source, ...args], {
            encoding: 'utf8',
          }).trim()
        sourceRevision = git('rev-parse', 'FETCH_HEAD')
        sourceUpdatedAt = git('show', '-s', '--format=%cI', 'FETCH_HEAD')
        const csv = execFileSync('git', [
          '-C',
          source,
          'show',
          `FETCH_HEAD:${csvPath}`,
        ])
        const csvFile = join(directory, `${entry.season}.csv`)
        await writeFile(csvFile, csv)
        const stagingPath = join(directory, `${entry.season}.db`)
        execFileSync('sqlite3', [
          stagingPath,
          `.import --csv "${csvFile}" incoming`,
        ])
        const staging = new Database(stagingPath)
        try {
          rows = normalizePlayers(
            staging.query('SELECT * FROM incoming').all(),
            staging
              .query('PRAGMA table_info(incoming)')
              .all()
              .map((column) => column.name),
          )
        } finally {
          staging.close()
        }
      }
      // Preserve metadata on no-op refreshes, even if unrelated upstream files changed.
      const contentHash = createHash('sha256')
        .update(JSON.stringify(rows))
        .digest('hex')
      const prior = previous?.seasons.find(
        (season) =>
          season.season === entry.season &&
          season.contentHash === contentHash &&
          season.status === entry.status,
      )
      const unchanged =
        prior &&
        (prior.source || 'github') === entry.source &&
        JSON.stringify(prior.coverage) === JSON.stringify(coverage)
      const metadata = unchanged
        ? {
            ...prior,
            source: entry.source,
            sourceURL,
            dataChangedAt: prior.dataChangedAt || prior.importedAt,
          }
        : {
            season: entry.season,
            status: entry.status,
            sourceRevision,
            sourceUpdatedAt,
            importedAt: now(),
            contentHash,
            source: entry.source,
            sourceURL,
            capturedAt,
            coverage,
            dataChangedAt: prior?.dataChangedAt || prior?.importedAt || now(),
          }
      seasons.push(metadata)
      const insert = database.prepare(
        `INSERT INTO player_seasons VALUES (${Array(
          Object.keys(columns).length + 1,
        )
          .fill('?')
          .join(',')})`,
      )
      database.transaction(() => {
        for (const row of rows) insert.run(entry.season, ...row)
        database
          .prepare(
            'INSERT INTO seasons VALUES (?, ?, ?, ?, ?, 2, ?, ?, ?, ?, ?)',
          )
          .run(
            entry.season,
            entry.status,
            metadata.sourceRevision,
            metadata.sourceUpdatedAt,
            metadata.importedAt,
            metadata.source,
            metadata.sourceURL,
            metadata.capturedAt || null,
            metadata.dataChangedAt,
            metadata.coverage ? JSON.stringify(metadata.coverage) : null,
          )
      })()
      console.log(`${entry.season}: ${rows.length} players (${entry.status})`)
    }
    database.exec(
      `CREATE VIEW players AS SELECT ${Object.keys(columns)
        .map((name) => `"${name}"`)
        .join(
          ', ',
        )} FROM player_seasons WHERE season = '${catalog.currentSeason}'`,
    )
    database
      .prepare('INSERT INTO meta VALUES (?)')
      .run(
        seasons.find((season) => season.season === catalog.currentSeason)
          .importedAt,
      )
    const revision = createHash('sha256')
      .update(
        JSON.stringify({
          schemaVersion: 2,
          currentSeason: catalog.currentSeason,
          seasons,
          columns,
        }),
      )
      .digest('hex')
      .slice(0, 16)
    const manifest = {
      schemaVersion: 2,
      currentSeason: catalog.currentSeason,
      revision,
      seasons,
    }
    if (previous?.revision === revision) {
      console.log('Database unchanged')
      return
    }
    if (database.query('PRAGMA integrity_check').get().integrity_check !== 'ok')
      throw new Error('Integrity check failed')
    database.close()
    // Validate everything before replacing either published artifact. Git publishes
    // the bundle + manifest together; revision keys prevent stale browser caches.
    await writeFile(`${output}.tmp`, await readFile(join(directory, 'next.db')))
    await writeFile(
      `${manifestPath}.tmp`,
      `${JSON.stringify(manifest, null, 2)}\n`,
    )
    await rename(`${output}.tmp`, output)
    await rename(`${manifestPath}.tmp`, manifestPath)
    console.log(`Published bundle ${revision}`)
  } finally {
    database.close()
    await rm(directory, { recursive: true, force: true })
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href)
  await buildDatabase()
