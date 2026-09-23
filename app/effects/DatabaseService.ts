import { Effect, Context, Layer, pipe } from 'effect'
import { QueryExecutionError, DatabaseCreationError } from './Errors'
import { type Database, type QueryExecResult, SqlJsStatic } from 'sql.js'

export interface DatabaseService {
  database: (
    // TODO: SQL probably should be injected?
    SQL: SqlJsStatic,
    databasePath: string,
  ) => Effect.Effect<Database, Error>
  executeQuery: (
    database: Database,
    query: string,
  ) => Effect.Effect<QueryExecResult[], QueryExecutionError>
}

export const DatabaseService = Context.GenericTag<DatabaseService>('DatabaseService')

export const DatabaseServiceLive = Layer.succeed(
  DatabaseService,
  DatabaseService.of({
    database: (SQL: SqlJsStatic, databasePath: string) =>
      getDatabase(SQL, databasePath),
    executeQuery: (database: Database, query: string) =>
      executeQuery(database, query),
  }),
)

// The SQLite database is read-only and expensive to build (full file fetch +
// parse), so cache one instance per path instead of rebuilding it per query.
const databaseCache = new Map<string, Database>()

function getDatabase(SQL: SqlJsStatic, databasePath: string) {
  const cached = databaseCache.get(databasePath)
  if (cached) {
    return Effect.succeed(cached)
  }

  const program = pipe(
    Effect.tryPromise({
      try: () => fetch(databasePath),
      catch: (e) => new DatabaseCreationError(`${e}`),
    }),
    Effect.flatMap((response) =>
      Effect.tryPromise({
        try: () => response.arrayBuffer(),
        catch: (e) => new DatabaseCreationError(`${e}`),
      }),
    ),
    Effect.map((buffer) => {
      const database = new SQL.Database(new Uint8Array(buffer))
      databaseCache.set(databasePath, database)
      return database
    }),
  )
  return program
}

function executeQuery(database: Database, query: string) {
  const program = Effect.try({
    try: () => database.exec(query),
    catch: (e) => new QueryExecutionError(`${e}`),
  })
  return program
}
