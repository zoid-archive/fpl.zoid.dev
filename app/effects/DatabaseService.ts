import { type SqlJsStatic } from 'sql.js'

// Cache immutable bytes, not mutable SQL sessions. Each execution gets an
// isolated view of its season, so switching/other consumers cannot affect it.
const downloads = new Map<string, Promise<Uint8Array>>()

export async function createSeasonDatabase(
  SQL: SqlJsStatic,
  path: string,
  season: string,
) {
  let download = downloads.get(path)
  if (!download) {
    download = fetch(path)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`Database download failed (${response.status})`)
        return new Uint8Array(await response.arrayBuffer())
      })
      .catch((error) => {
        downloads.delete(path)
        throw error
      })
    downloads.set(path, download)
  }
  const database = new SQL.Database(await download)
  try {
    if (
      !database.exec('SELECT season FROM seasons WHERE season = ?', [season])[0]
        ?.values.length
    ) {
      throw new Error(
        `Season ${season} is not available. Choose an included season.`,
      )
    }
    const columns = database
      .exec('PRAGMA table_info(players)')[0]
      .values.map((column) => `"${String(column[1]).replaceAll('"', '""')}"`)
      .join(', ')
    const literal = `'${season.replaceAll("'", "''")}'`
    database.exec(`CREATE TEMP VIEW players AS SELECT ${columns} FROM player_seasons WHERE season = ${literal};
      CREATE TEMP VIEW meta AS SELECT imported_at AS lastUpdated FROM seasons WHERE season = ${literal};`)
    return database
  } catch (error) {
    database.close()
    throw error
  }
}
