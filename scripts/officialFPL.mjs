export const officialURL =
  'https://fantasy.premierleague.com/api/bootstrap-static/'

// The public endpoint has no supported quota or SLA. Retry transient failures
// only, with a bounded wait; never work around an access denial.
export async function fetchOfficial({
  fetcher = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
} = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response
    try {
      response = await fetcher(officialURL, {
        signal: AbortSignal.timeout(30_000),
      })
      if (response.ok) return await response.json()
    } catch (error) {
      // Malformed JSON is an invalid snapshot, not a transient transport error.
      if (error instanceof SyntaxError || attempt === 2) throw error
      await sleep(2_000 * 2 ** attempt)
      continue
    }
    if (attempt === 2 || (response.status !== 429 && response.status < 500)) {
      throw new Error(`Official FPL request failed (${response.status})`)
    }
    const retryAfter = response.headers.get('retry-after')
    const requestedWait =
      retryAfter == null
        ? 0
        : /^\d+$/.test(retryAfter)
          ? Number(retryAfter) * 1_000
          : Date.parse(retryAfter) - now()
    const wait = Math.max(
      2_000 * 2 ** attempt,
      Number.isFinite(requestedWait) ? requestedWait : 0,
    )
    if (wait > 60_000)
      throw new Error(
        'Official FPL requested a retry beyond the refresh budget',
      )
    await sleep(wait)
  }
}

export function officialSnapshot(payload, season, columns) {
  const fail = (message) => {
    throw new Error(`Invalid official FPL data: ${message}`)
  }
  const marker =
    payload?.game_config?.settings?.static_content_url?.match(
      /\/(\d{4})_(\d{2})\//,
    )
  if (!marker || `${marker[1]}-${marker[2]}` !== season)
    fail('season marker mismatch or missing')
  const startYear = Number(season.slice(0, 4))
  if (season.slice(5) !== String(startYear + 1).slice(-2))
    fail('invalid season range')
  if (!Array.isArray(payload.events) || !payload.events.length)
    fail('missing events')
  const eventIDs = new Set()
  const events = payload.events
    .map((event) => {
      const deadline = new Date(event.deadline_time)
      if (!Number.isInteger(event.id) || event.id < 1 || eventIDs.has(event.id))
        fail('invalid or duplicate event ID')
      eventIDs.add(event.id)
      if (
        !Number.isFinite(deadline.getTime()) ||
        deadline.getUTCFullYear() < startYear ||
        deadline.getUTCFullYear() > startYear + 1
      )
        fail('event deadline outside configured season')
      for (const flag of [
        'finished',
        'data_checked',
        'is_current',
        'is_next',
      ]) {
        if (typeof event[flag] !== 'boolean') fail(`missing event ${flag}`)
      }
      return {
        id: event.id,
        finished: event.finished,
        dataChecked: event.data_checked,
        isCurrent: event.is_current,
        isNext: event.is_next,
      }
    })
    .sort((a, b) => a.id - b.id)
  if (
    events.filter((event) => event.isCurrent).length > 1 ||
    events.filter((event) => event.isNext).length > 1
  )
    fail('ambiguous current/next event')
  if (!Array.isArray(payload.element_types) || !payload.element_types.length)
    fail('missing positions')
  const positions = new Map()
  const names = { GKP: 'GK', DEF: 'DEF', MID: 'MID', FWD: 'FWD' }
  for (const position of payload.element_types) {
    const name = names[position.singular_name_short]
    if (!Number.isInteger(position.id) || positions.has(position.id) || !name)
      fail('unknown or duplicate position')
    positions.set(position.id, name)
  }
  if (!Array.isArray(payload.elements) || !payload.elements.length)
    fail('empty players')
  const ids = new Set()
  const players = [...payload.elements]
    .sort((a, b) => a.id - b.id)
    .map((player) => {
      if (!Number.isInteger(player.id) || player.id < 1 || ids.has(player.id))
        fail('invalid or duplicate player ID')
      ids.add(player.id)
      if (!positions.has(player.element_type)) fail('unknown player position')
      const row = {
        ...player,
        element_type: positions.get(player.element_type),
      }
      for (const [name, type] of Object.entries(columns)) {
        const value = row[name]
        if (type === 'TEXT' && name !== 'bps') {
          if (typeof value !== 'string' || !value.trim())
            fail(`missing text ${name}`)
        } else {
          if (
            (typeof value !== 'number' && typeof value !== 'string') ||
            String(value).trim() === '' ||
            !Number.isFinite(Number(value))
          )
            fail(`invalid number ${name}`)
          if (
            (type === 'INTEGER' || name === 'bps') &&
            !Number.isInteger(Number(value))
          )
            fail(`noninteger ${name}`)
        }
      }
      if (
        Number(row.minutes) < 0 ||
        Number(row.now_cost) <= 0 ||
        Number(row.selected_by_percent) < 0 ||
        Number(row.selected_by_percent) > 100
      )
        fail('invalid minutes, price or ownership')
      return row
    })
  return { players, coverage: { events } }
}
