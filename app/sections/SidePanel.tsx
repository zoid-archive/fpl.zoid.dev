'use client'

import { useElectric } from 'app/Providers'
import { Card } from 'app/components/Card'
import { SchemaTree } from 'app/components/SchemaTree'
import { useSQL } from 'app/hooks/useSQL'
import { initElectric } from 'app/initElectric'
import { getAllColumns } from 'app/lib/sql'
import { useLiveQuery } from 'electric-sql/react'
import Link from 'next/link'
import { useEffect } from 'react'

import { FPL_DB_PATH, SQL_WASM_WASM_PATH } from './Dashboard'

interface Props {
  db: Awaited<ReturnType<typeof initElectric>>['electric']['db']
}

export const Strategies = ({ db }: Props) => {
  const { results: strategies } = useLiveQuery(
    db.Strategy.liveMany({
      orderBy: {
        updatedAt: 'desc',
      },
    }),
  )

  useEffect(() => {
    async function f() {
      const strategyShape = await db.Strategy.sync()
      await strategyShape.synced
    }
    f()
  }, [db])

  return (
    <Card title="Strategies" description="Community-published queries">
      {strategies && strategies.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing published yet — run a query and hit Publish.
        </p>
      ) : (
        <ul className="space-y-1">
          {strategies?.map((strategy) => {
            return (
              <li key={strategy.id} className="min-w-0">
                <Link
                  href={`/strategy/${strategy.id}`}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="truncate">{strategy.name}</span>
                  <span aria-hidden="true" className="text-muted-foreground">
                    →
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export const SidePanel = () => {
  const { data: structureData } = useSQL<{
    tableName: string
    columnName: string
  }>({
    query: getAllColumns(),
    databasePath: FPL_DB_PATH,
    sqlWASMPath: SQL_WASM_WASM_PATH,
  })

  const electric = useElectric()

  return (
    <>
      {electric && <Strategies db={electric?.db}></Strategies>}

      <Card title="Database schema" description="Tables bundled with the app">
        <SchemaTree data={structureData} />
      </Card>
    </>
  )
}
