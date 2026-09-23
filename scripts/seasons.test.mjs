import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildDatabase, columns, normalizePlayers } from './getLatestFPLDatabase.mjs'
import { createSeasonDatabase } from '../app/effects/DatabaseService.ts'
import { getAllColumns } from '../app/lib/sql.ts'
import { isSeasonBinding, resolveSeason, manifest } from '../app/lib/seasons.ts'

test('normalization follows headers, preserves zero/UTF-8, and distinguishes missing metrics', () => {
  const row = { minutes: '0', now_cost: '49', second_name: "O'Nien", first_name: 'Lukás', element_type: 'DEF', total_points: '7', assists: '0', bps: '-1', value_per_m: '1.4' }
  const result = Object.fromEntries(Object.keys(columns).map((name, index) => [name, normalizePlayers([row], Object.keys(row))[0][index]]))
  assert.equal(result.first_name, 'Lukás')
  assert.equal(result.second_name, "O'Nien")
  assert.equal(result.minutes, 0)
  assert.equal(result.total_points, 7)
  assert.equal(result.now_cost, 49)
  assert.equal(result.assists, 0)
  assert.equal(result.goals_scored, null)
  assert.equal(result.bps, '-1')
  assert.equal(result.value_per_m, undefined)
  assert.throws(() => normalizePlayers([row], Object.keys(row).filter((name) => name !== 'minutes')), /Missing required column/)
  assert.throws(() => normalizePlayers([{ ...row, minutes: '1.5' }], Object.keys(row)), /Invalid numeric/)
  assert.throws(() => normalizePlayers([{ ...row, now_cost: 'NaN' }], Object.keys(row)), /Invalid numeric/)
  assert.throws(() => normalizePlayers([{ ...row, element_type: '1' }], Object.keys(row)), /Invalid position/)
  assert.throws(() => normalizePlayers([], Object.keys(row)), /Empty season/)
})

test('season sessions isolate selected views and writes while retaining all-season SQL', async () => {
  const require = createRequire(import.meta.url)
  const initSQL = require('../public/assets/sql.js/1.8.0/sql-wasm.js')
  const SQL = await initSQL({ wasmBinary: await readFile('public/assets/sql.js/1.8.0/sql-wasm.wasm') })
  const fixture = new SQL.Database()
  fixture.exec(`CREATE TABLE player_seasons (season TEXT, first_name TEXT, total_points INTEGER);
    INSERT INTO player_seasons VALUES ('2025-26', 'Archive A', 300), ('2025-26', 'Archive B', 150), ('2026-27', 'Current', 12);
    CREATE TABLE seasons (season TEXT, imported_at TEXT);
    INSERT INTO seasons VALUES ('2025-26', '2026-05-25'), ('2026-27', '2026-08-28');
    CREATE VIEW players AS SELECT first_name, total_points FROM player_seasons WHERE season = '2026-27';
    CREATE TABLE meta (lastUpdated TEXT);`)
  const path = `data:application/octet-stream;base64,${Buffer.from(fixture.export()).toString('base64')}`
  fixture.close()
  const [archive, current] = await Promise.all([
    createSeasonDatabase(SQL, path, '2025-26'),
    createSeasonDatabase(SQL, path, '2026-27'),
  ])
  try {
    assert.deepEqual(archive.exec('SELECT * FROM players ORDER BY total_points DESC')[0].values, [['Archive A', 300], ['Archive B', 150]])
    assert.deepEqual(current.exec('SELECT * FROM players')[0].values, [['Current', 12]])
    assert.deepEqual(archive.exec('SELECT * FROM meta')[0].values, [['2026-05-25']])
    assert.deepEqual(current.exec('SELECT season, SUM(total_points) FROM player_seasons GROUP BY season ORDER BY season')[0].values, [['2025-26', 450], ['2026-27', 12]])
    const schema = archive.exec(getAllColumns())[0].values
    assert.ok(schema.some(([table, column]) => table === 'players' && column === 'total_points'))
    assert.ok(!schema.some(([table, column]) => table === 'players' && column === 'season'))
    archive.exec("DELETE FROM player_seasons WHERE season = '2026-27'")
    assert.deepEqual(current.exec('SELECT * FROM players')[0].values, [['Current', 12]])
    const fresh = await createSeasonDatabase(SQL, path, '2026-27')
    try { assert.deepEqual(fresh.exec('SELECT * FROM players')[0].values, [['Current', 12]]) } finally { fresh.close() }
    await assert.rejects(createSeasonDatabase(SQL, path, "missing' OR 1=1 --"), /not available/)
  } finally { archive.close(); current.close() }
})

test('fixed season stays fixed; current binding resolves via the catalog', () => {
  assert.equal(resolveSeason('2025-26'), '2025-26')
  assert.equal(resolveSeason('current'), manifest.currentSeason)
  assert.equal(isSeasonBinding('current'), true)
  assert.equal(isSeasonBinding('2025-26'), true)
  assert.equal(isSeasonBinding('2020-21'), false)
  // Do not silently fall back for a missing pinned season.
  assert.equal(resolveSeason('2020-21'), '2020-21')
  const previous = manifest.currentSeason
  try {
    manifest.currentSeason = '2027-28'
    assert.equal(resolveSeason('current'), '2027-28')
    assert.equal(resolveSeason('2026-27'), '2026-27')
  } finally { manifest.currentSeason = previous }
})

test('invalid import configuration leaves the published artifacts intact', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fpl-publish-test-'))
  const output = join(directory, 'fpl.db')
  const manifestPath = join(directory, 'fpl.json')
  try {
    await writeFile(output, 'last good database')
    await writeFile(manifestPath, 'last good manifest')
    await assert.rejects(buildDatabase({ output, manifestPath, catalog: { currentSeason: '2027-28', seasons: [] } }), /Current season must be included/)
    assert.equal(await readFile(output, 'utf8'), 'last good database')
    assert.equal(await readFile(manifestPath, 'utf8'), 'last good manifest')
  } finally { await rm(directory, { recursive: true, force: true }) }
})
