import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildDatabase,
  columns,
  normalizePlayers,
} from './getLatestFPLDatabase.mjs'
import { createSeasonDatabase } from '../app/effects/DatabaseService.ts'
import { getAllColumns } from '../app/lib/sql.ts'
import { isSeasonBinding, resolveSeason, manifest } from '../app/lib/seasons.ts'
import { Database } from 'bun:sqlite'
import { fetchOfficial, officialSnapshot } from './officialFPL.mjs'
import { createHash } from 'node:crypto'

test('normalization follows headers, preserves zero/UTF-8, and distinguishes missing metrics', () => {
  const row = {
    minutes: '0',
    now_cost: '49',
    second_name: "O'Nien",
    first_name: 'Lukás',
    element_type: 'DEF',
    total_points: '7',
    assists: '0',
    bps: '-1',
    value_per_m: '1.4',
  }
  const result = Object.fromEntries(
    Object.keys(columns).map((name, index) => [
      name,
      normalizePlayers([row], Object.keys(row))[0][index],
    ]),
  )
  assert.equal(result.first_name, 'Lukás')
  assert.equal(result.second_name, "O'Nien")
  assert.equal(result.minutes, 0)
  assert.equal(result.total_points, 7)
  assert.equal(result.now_cost, 49)
  assert.equal(result.assists, 0)
  assert.equal(result.goals_scored, null)
  assert.equal(result.bps, '-1')
  assert.equal(result.value_per_m, undefined)
  assert.throws(
    () =>
      normalizePlayers(
        [row],
        Object.keys(row).filter((name) => name !== 'minutes'),
      ),
    /Missing required column/,
  )
  assert.throws(
    () => normalizePlayers([{ ...row, minutes: '1.5' }], Object.keys(row)),
    /Invalid numeric/,
  )
  assert.throws(
    () => normalizePlayers([{ ...row, now_cost: 'NaN' }], Object.keys(row)),
    /Invalid numeric/,
  )
  assert.throws(
    () => normalizePlayers([{ ...row, element_type: '1' }], Object.keys(row)),
    /Invalid position/,
  )
  assert.throws(() => normalizePlayers([], Object.keys(row)), /Empty season/)
})

test('season sessions isolate selected views and writes while retaining all-season SQL', async () => {
  const require = createRequire(import.meta.url)
  const initSQL = require('../public/assets/sql.js/1.8.0/sql-wasm.js')
  const SQL = await initSQL({
    wasmBinary: await readFile('public/assets/sql.js/1.8.0/sql-wasm.wasm'),
  })
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
    assert.deepEqual(
      archive.exec('SELECT * FROM players ORDER BY total_points DESC')[0]
        .values,
      [
        ['Archive A', 300],
        ['Archive B', 150],
      ],
    )
    assert.deepEqual(current.exec('SELECT * FROM players')[0].values, [
      ['Current', 12],
    ])
    assert.deepEqual(archive.exec('SELECT * FROM meta')[0].values, [
      ['2026-05-25'],
    ])
    assert.deepEqual(
      current.exec(
        'SELECT season, SUM(total_points) FROM player_seasons GROUP BY season ORDER BY season',
      )[0].values,
      [
        ['2025-26', 450],
        ['2026-27', 12],
      ],
    )
    const schema = archive.exec(getAllColumns())[0].values
    assert.ok(
      schema.some(
        ([table, column]) => table === 'players' && column === 'total_points',
      ),
    )
    assert.ok(
      !schema.some(
        ([table, column]) => table === 'players' && column === 'season',
      ),
    )
    archive.exec("DELETE FROM player_seasons WHERE season = '2026-27'")
    assert.deepEqual(current.exec('SELECT * FROM players')[0].values, [
      ['Current', 12],
    ])
    const fresh = await createSeasonDatabase(SQL, path, '2026-27')
    try {
      assert.deepEqual(fresh.exec('SELECT * FROM players')[0].values, [
        ['Current', 12],
      ])
    } finally {
      fresh.close()
    }
    await assert.rejects(
      createSeasonDatabase(SQL, path, "missing' OR 1=1 --"),
      /not available/,
    )
  } finally {
    archive.close()
    current.close()
  }
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
  } finally {
    manifest.currentSeason = previous
  }
})

test('invalid import configuration leaves the published artifacts intact', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fpl-publish-test-'))
  const output = join(directory, 'fpl.db')
  const manifestPath = join(directory, 'fpl.json')
  try {
    await writeFile(output, 'last good database')
    await writeFile(manifestPath, 'last good manifest')
    await assert.rejects(
      buildDatabase({
        output,
        manifestPath,
        catalog: { currentSeason: '2027-28', seasons: [] },
      }),
      /Current season must be included/,
    )
    assert.equal(await readFile(output, 'utf8'), 'last good database')
    assert.equal(await readFile(manifestPath, 'utf8'), 'last good manifest')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

function officialFixture() {
  const player = {
    id: 9,
    first_name: 'Lukás',
    second_name: "O'Nien",
    goals_scored: 2,
    assists: 3,
    total_points: 37,
    minutes: 451,
    goals_conceded: 4,
    creativity: '12.3',
    influence: '45.6',
    threat: '7.8',
    bonus: 1,
    bps: -2,
    ict_index: '6.7',
    clean_sheets: 2,
    red_cards: 0,
    yellow_cards: 1,
    selected_by_percent: '42.2',
    now_cost: 61,
    element_type: 7,
  }
  return {
    game_config: {
      settings: { static_content_url: 'https://example.test/2026_27/' },
    },
    elements: [
      player,
      {
        ...player,
        id: 2,
        first_name: 'Other',
        element_type: 3,
        now_cost: 49,
        minutes: 0,
        total_points: -1,
      },
    ],
    element_types: [
      { id: 7, singular_name_short: 'GKP' },
      { id: 3, singular_name_short: 'MID' },
    ],
    events: [
      {
        id: 1,
        deadline_time: '2026-08-21T17:30:00Z',
        finished: true,
        data_checked: true,
        is_current: false,
        is_next: false,
      },
      {
        id: 2,
        deadline_time: '2026-08-28T17:30:00Z',
        finished: false,
        data_checked: false,
        is_current: true,
        is_next: false,
      },
    ],
  }
}

test('bundled historical rows retain their pre-API pinned snapshot', () => {
  const db = new Database('public/assets/fpl.db', { readonly: true })
  try {
    const rows = db
      .query(
        `SELECT ${Object.keys(columns)
          .map((name) => `"${name}"`)
          .join(
            ',',
          )} FROM player_seasons WHERE season = '2025-26' ORDER BY rowid`,
      )
      .values()
    // Independently recorded before the API migration, not derived from the new manifest.
    assert.equal(rows.length, 841)
    assert.equal(
      createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
      '1b86255fb573d5a2a2e44e313894640fadfb922c05afc138f05cc768cbad536d',
    )
    assert.equal(
      db
        .query("SELECT source_revision FROM seasons WHERE season = '2025-26'")
        .get().source_revision,
      '9779cdbc0c07f6c900c2d0c181ddf6bb9c800f88',
    )
  } finally {
    db.close()
  }
})

test('official values preserve SQL units and resolve position definitions, not assumed IDs', () => {
  const { players, coverage } = officialSnapshot(
    officialFixture(),
    '2026-27',
    columns,
  )
  const rows = normalizePlayers(players, Object.keys(columns))
  assert.deepEqual(rows[1], [
    'Lukás',
    "O'Nien",
    2,
    3,
    37,
    451,
    4,
    12.3,
    45.6,
    7.8,
    1,
    '-2',
    6.7,
    2,
    0,
    1,
    42.2,
    61,
    'GK',
  ])
  assert.equal(rows[0][0], 'Other')
  assert.equal(rows[0][4], -1)
  assert.equal(rows[0][5], 0)
  assert.equal(rows[0][17], 49)
  assert.equal(rows[0][18], 'MID')
  assert.deepEqual(coverage.events[1], {
    id: 2,
    finished: false,
    dataChecked: false,
    isCurrent: true,
    isNext: false,
  })
})

test('official validation rejects rollover, ambiguous IDs, missing stats and malformed values', () => {
  for (const mutate of [
    (p) => {
      p.game_config.settings.static_content_url =
        'https://example.test/2027_28/'
    },
    (p) => {
      delete p.game_config
    },
    (p) => {
      p.events[1].deadline_time = '2028-01-01'
    },
    (p) => {
      p.events[1].id = 1
    },
    (p) => {
      delete p.events[1].data_checked
    },
    (p) => {
      p.elements[1].id = 9
    },
    (p) => {
      p.elements = []
    },
    (p) => {
      p.elements[0].element_type = 99
    },
    (p) => {
      p.element_types[0].singular_name_short = 'NEW'
    },
    (p) => {
      delete p.elements[0].assists
    },
    (p) => {
      p.elements[0].minutes = 1.5
    },
    (p) => {
      p.elements[0].now_cost = 0
    },
    (p) => {
      p.elements[0].selected_by_percent = '100.1'
    },
    (p) => {
      p.elements[0].creativity = 'NaN'
    },
    (p) => {
      p.elements[0].assists = true
    },
  ]) {
    const payload = officialFixture()
    mutate(payload)
    assert.throws(
      () => officialSnapshot(payload, '2026-27', columns),
      /Invalid official FPL data/,
    )
  }
})

test('official fetch bounds retries, respects Retry-After and does not retry access denials', async () => {
  let calls = 0
  const waits = []
  const result = await fetchOfficial({
    fetcher: async () => {
      calls++
      if (calls === 1)
        return new Response('', {
          status: 429,
          headers: { 'Retry-After': '7' },
        })
      if (calls === 2) return new Response('', { status: 503 })
      return Response.json({ ok: true })
    },
    sleep: async (ms) => waits.push(ms),
  })
  assert.deepEqual(result, { ok: true })
  assert.equal(calls, 3)
  assert.deepEqual(waits, [7000, 4000])
  for (const [status, expectedCalls, retryAfter] of [
    [403, 1],
    [503, 3],
    [429, 1, '120'],
  ]) {
    calls = 0
    await assert.rejects(
      fetchOfficial({
        fetcher: async () => {
          calls++
          return new Response('', {
            status,
            headers: retryAfter ? { 'Retry-After': retryAfter } : {},
          })
        },
        sleep: async () => {},
      }),
    )
    assert.equal(calls, expectedCalls)
  }
  const datedWaits = []
  calls = 0
  await fetchOfficial({
    now: () => Date.parse('2026-09-23T12:00:00Z'),
    sleep: async (ms) => datedWaits.push(ms),
    fetcher: async () =>
      ++calls === 1
        ? new Response('', {
            status: 429,
            headers: { 'Retry-After': 'Wed, 23 Sep 2026 12:00:09 GMT' },
          })
        : Response.json({}),
  })
  assert.deepEqual(datedWaits, [9000])
  calls = 0
  await assert.rejects(
    fetchOfficial({
      fetcher: async () => {
        calls++
        throw new Error('network down')
      },
      sleep: async () => {},
    }),
    /network down/,
  )
  assert.equal(calls, 3)
  calls = 0
  await assert.rejects(
    fetchOfficial({
      fetcher: async () => {
        calls++
        return {
          ok: true,
          json: async () => {
            throw new Error('body interrupted')
          },
        }
      },
      sleep: async () => {},
    }),
    /body interrupted/,
  )
  assert.equal(calls, 3)
  calls = 0
  await assert.rejects(
    fetchOfficial({
      fetcher: async () => {
        calls++
        return new Response('not JSON')
      },
      sleep: async () => {},
    }),
    SyntaxError,
  )
  assert.equal(calls, 1)
})

test('official rebuilds distinguish checks, data changes and coverage; failures preserve both artifacts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fpl-official-test-'))
  const output = join(directory, 'fpl.db')
  const manifestPath = join(directory, 'fpl.json')
  const catalog = {
    currentSeason: '2026-27',
    seasons: [{ season: '2026-27', status: 'partial', source: 'official' }],
  }
  const payload = officialFixture()
  let time = '2026-09-23T12:00:00.000Z'
  const options = {
    output,
    manifestPath,
    catalog,
    loadOfficial: async () => payload,
    now: () => time,
  }
  const readManifest = async () =>
    JSON.parse(await readFile(manifestPath, 'utf8'))
  try {
    await buildDatabase(options)
    const initial = await readManifest()
    const initialBytes = await readFile(output)
    const db = new Database(output, { readonly: true })
    try {
      assert.deepEqual(
        db
          .query(
            'SELECT first_name, now_cost, selected_by_percent, element_type FROM players ORDER BY minutes DESC',
          )
          .values(),
        [
          ['Lukás', 61, 42.2, 'GK'],
          ['Other', 49, 42.2, 'MID'],
        ],
      )
      assert.equal(
        db.query('SELECT source_updated_at FROM seasons').get()
          .source_updated_at,
        null,
      )
    } finally {
      db.close()
    }
    time = '2026-09-23T13:00:00.000Z'
    payload.elements.reverse()
    payload.events.reverse()
    payload.game_config.status = { price_change_last_updated: time }
    await buildDatabase(options)
    assert.deepEqual(await readManifest(), initial)
    assert.deepEqual(await readFile(output), initialBytes)
    payload.events.find((event) => event.id === 2).finished = true
    await buildDatabase(options)
    const coverageChanged = await readManifest()
    assert.notEqual(coverageChanged.revision, initial.revision)
    assert.equal(
      coverageChanged.seasons[0].contentHash,
      initial.seasons[0].contentHash,
    )
    assert.equal(
      coverageChanged.seasons[0].dataChangedAt,
      initial.seasons[0].dataChangedAt,
    )
    assert.equal(coverageChanged.seasons[0].capturedAt, time)
    time = '2026-09-23T14:00:00.000Z'
    payload.elements[0].now_cost = 50
    await buildDatabase(options)
    const changed = await readManifest()
    assert.notEqual(
      changed.seasons[0].contentHash,
      initial.seasons[0].contentHash,
    )
    assert.equal(changed.seasons[0].dataChangedAt, time)
    const goodDB = await readFile(output)
    const goodManifest = await readFile(manifestPath)
    payload.game_config.settings.static_content_url =
      'https://example.test/2027_28/'
    await assert.rejects(buildDatabase(options), /season marker/)
    await assert.rejects(
      buildDatabase({
        ...options,
        loadOfficial: async () => {
          throw new Error('network down')
        },
      }),
      /network down/,
    )
    assert.deepEqual(await readFile(output), goodDB)
    assert.deepEqual(await readFile(manifestPath), goodManifest)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
