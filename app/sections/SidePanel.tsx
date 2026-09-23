'use client'

import { listStrategies } from 'app/actions/createStrategy'
import { Card } from 'app/components/Card'
import { SchemaTree } from 'app/components/SchemaTree'
import { useSQL } from 'app/hooks/useSQL'
import { getAllColumns } from 'app/lib/sql'
import { FPL_DB_PATH, SQL_WASM_WASM_PATH } from 'app/lib/seasons'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export const SidePanel = ({ season }: { season: string }) => {
  const { data: structureData, error } = useSQL<{
    tableName: string
    columnName: string
  }>({
    query: getAllColumns(),
    databasePath: FPL_DB_PATH,
    sqlWASMPath: SQL_WASM_WASM_PATH,
    season,
  })
  const [strategies, setStrategies] = useState<
    Awaited<ReturnType<typeof listStrategies>>
  >([])
  const [strategyStatus, setStrategyStatus] = useState('Loading strategies…')
  useEffect(() => {
    let cancelled = false
    listStrategies()
      .then((data) => {
        if (!cancelled) {
          setStrategies(data)
          setStrategyStatus(
            data.length
              ? ''
              : 'Nothing published yet — run a query and hit Publish.',
          )
        }
      })
      .catch(() => {
        if (!cancelled)
          setStrategyStatus(
            'Strategies are unavailable. SQL queries still work locally.',
          )
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <Card title="Database schema" description="Season totals · SQLite">
        <div className="mb-3 space-y-2 text-xs text-muted-foreground">
          <p>
            <code className="text-foreground">players</code> — selected season (
            {season})
          </p>
          <p>
            <code className="text-foreground">player_seasons</code> — all
            included seasons
          </p>
          <p>
            <code className="text-foreground">seasons</code> — coverage and
            source revisions
          </p>
        </div>
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : (
          <SchemaTree data={structureData} />
        )}
      </Card>
      <Card title="Strategies" description="Community-published queries">
        {strategyStatus && (
          <p className="text-sm text-muted-foreground">{strategyStatus}</p>
        )}
        <ul className="space-y-1">
          {strategies.map((strategy) => (
            <li key={strategy.id} className="min-w-0">
              <Link
                href={`/strategy/${strategy.id}`}
                className="block rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <span className="block truncate font-medium">
                  {strategy.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {strategy.season === 'current'
                    ? 'Always current season'
                    : strategy.season}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}
