import { useCallback, useEffect, useState } from 'react'
import { type QueryExecResult, type SqlJsStatic } from 'sql.js'
import { createSeasonDatabase } from '../effects/DatabaseService'
import { getRowDataFromResultSet } from '../lib/sql'

interface UseSQLArgs {
  query: string
  databasePath: string
  sqlWASMPath: string
  season: string
}

const engines = new Map<string, Promise<SqlJsStatic>>()

function loadSQL(path: string) {
  let engine = engines.get(path)
  if (!engine) {
    engine = (async () => {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (window.initSqlJs)
          return window.initSqlJs({ locateFile: () => path })
        await new Promise((resolve) => window.setTimeout(resolve, 100))
      }
      throw new Error('SQL.js did not load. Reload the page to retry.')
    })().catch((error) => {
      engines.delete(path)
      throw error
    })
    engines.set(path, engine)
  }
  return engine
}

export function useSQL<T = Record<string, string>>({
  query: initialQuery,
  databasePath,
  sqlWASMPath,
  season,
}: UseSQLArgs) {
  const [execution, setExecution] = useState({ query: initialQuery, run: 0 })
  const [completed, setCompleted] = useState<{
    key: string
    result: QueryExecResult[]
    error: string
  } | null>(null)
  const key = JSON.stringify([databasePath, sqlWASMPath, season, execution])
  const setQuery = useCallback((query: string) => {
    setExecution((previous) => ({ query, run: previous.run + 1 }))
  }, [])

  useEffect(() => {
    let cancelled = false
    const execute = async () => {
      try {
        const SQL = await loadSQL(sqlWASMPath)
        if (cancelled) return
        const database = await createSeasonDatabase(SQL, databasePath, season)
        try {
          if (cancelled) return
          const result = database.exec(execution.query)
          if (!cancelled) setCompleted({ key, result, error: '' })
        } finally {
          database.close()
        }
      } catch (error) {
        if (!cancelled)
          setCompleted({
            key,
            result: [],
            error: String(error).replace(/^Error:\s*/, ''),
          })
      }
    }
    void execute()
    return () => {
      cancelled = true
    }
  }, [databasePath, sqlWASMPath, season, execution, key])

  // Never relabel an old result with the new season, even before the effect runs.
  const current = completed?.key === key ? completed : null
  const result = current?.result || []
  return {
    data: getRowDataFromResultSet(result[0]?.columns || [], result) as T[],
    error: current?.error || '',
    query: execution.query,
    setQuery,
    loading: !current,
    running: !current,
  }
}
