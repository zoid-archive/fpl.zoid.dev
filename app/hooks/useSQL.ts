import { useEffect, useState } from 'react'
import { type QueryExecResult, SqlJsStatic } from 'sql.js'

import { getRowDataFromResultSet } from '../lib/sql'
import { Effect } from 'effect'
import {
  DatabaseService,
  DatabaseServiceLive,
} from '../effects/DatabaseService'

interface UseSQLArgs {
  query: string
  databasePath: string
  sqlWASMPath: string
}

// sql.js is loaded through a <script> tag in the layout; poll until it is
// available instead of waiting on an arbitrary fixed delay.
const SQL_SCRIPT_POLL_INTERVAL_MS = 100
const SQL_SCRIPT_MAX_ATTEMPTS = 100

export function useSQL<T = Record<string, string>>({
  query: queryArg,
  databasePath,
  sqlWASMPath,
}: UseSQLArgs) {
  const [SQL, setSQL] = useState<SqlJsStatic | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState(queryArg)
  const [result, setResult] = useState<QueryExecResult[]>([])
  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async (attempt: number) => {
      if (cancelled) {
        return
      }

      const initSqlJs = window.initSqlJs

      if (!initSqlJs) {
        if (attempt < SQL_SCRIPT_MAX_ATTEMPTS) {
          window.setTimeout(
            () => load(attempt + 1),
            SQL_SCRIPT_POLL_INTERVAL_MS,
          )
        } else {
          console.error(`Failed to load SQL.js`)
          setLoading(false)
        }
        return
      }

      const SQL = await initSqlJs({
        locateFile: (url, scriptDirectory) => {
          return sqlWASMPath
        },
      })
      if (!cancelled) {
        setSQL(SQL)
      }
    }

    load(0)

    return () => {
      cancelled = true
    }
  }, [sqlWASMPath])

  useEffect(() => {
    const load = async () => {
      if (!SQL) {
        return
      }

      setRunning(true)

      const program = DatabaseService.pipe(
        Effect.flatMap((databaseService) => {
          const database = databaseService.database(SQL, databasePath)
          return database.pipe(
            Effect.flatMap((database) => {
              return databaseService.executeQuery(database, query)
            }),
          )
        }),
      )
      const runnable = Effect.provide(program, DatabaseServiceLive)

      runnable
        .pipe(
          Effect.map((result) => {
            setResult(result)
            setError('')
          }),
          Effect.catchAll((e) => {
            console.error(e)
            setError(e.message.replace(/^Error:\s*/, ''))
            return Effect.succeed([])
          }),
          Effect.runPromise,
        )
        .then(() => {
          setRunning(false)
          setLoading(false)
        })
        .catch(() => {
          setRunning(false)
          setLoading(false)
        })
    }
    load()
  }, [query, databasePath, SQL])

  const columns = result?.[0]?.columns || []
  const data = getRowDataFromResultSet(columns, result || [])

  return {
    data: data as T[],
    error,
    query,
    setQuery,
    running,
    loading,
  }
}
