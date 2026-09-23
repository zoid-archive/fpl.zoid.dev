'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { Card } from 'app/components/Card'
import { useEffect, useRef, useState } from 'react'

import { ActionButtons } from '../components/ActionButtons'
import { Credit } from '../components/Credit'
import { ResultSet } from '../components/ResultSet'
import { useSQL } from '../hooks/useSQL'
import { getDefaultQuery } from '../lib/sql'

export const FPL_DB_PATH = '/assets/fpl.db'
export const SQL_WASM_WASM_PATH = '/assets/sql.js/1.8.0/sql-wasm.wasm'

interface Props {
  name?: string
  description?: string
  queryFromDatabase?: string
}

function Dashboard({ name, description, queryFromDatabase }: Props) {
  const initialQuery = queryFromDatabase || getDefaultQuery()
  const [queryDraft, setQueryDraft] = useState<string>(initialQuery)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Grow the editor with its content so no query line is ever clipped.
  // Re-run on window resize because line wrapping changes with width.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) {
      return
    }
    const resize = () => {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
    resize()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
    }
  }, [queryDraft])
  const { data, error, running, loading, setQuery } = useSQL({
    query: initialQuery,
    databasePath: FPL_DB_PATH,
    sqlWASMPath: SQL_WASM_WASM_PATH,
  })

  const { data: resultLastUpdated } = useSQL<{ lastUpdated: string }>({
    query: `SELECT strftime('%d.%m.%Y %H:%M:%S (local time)', datetime(lastUpdated, 'localtime')) as "lastUpdated" FROM meta;`,
    databasePath: FPL_DB_PATH,
    sqlWASMPath: SQL_WASM_WASM_PATH,
  })

  const executeQuery = () => {
    setQuery(queryDraft)
  }

  const showResults = !loading && !error

  return (
    <div className="space-y-4">
      {name && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      <Credit lastUpdated={resultLastUpdated?.[0]?.lastUpdated}></Credit>

      <Card
        title="Query"
        actions={
          <ActionButtons
            queryDraft={queryDraft}
            setQueryDraft={setQueryDraft}
            setQuery={setQuery}
            running={running}
          ></ActionButtons>
        }
      >
        <Textarea
          ref={textareaRef}
          value={queryDraft}
          onChange={(e) => {
            setQueryDraft(e.target.value)
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              executeQuery()
            }
          }}
          spellCheck={false}
          aria-label="SQL query"
          className="min-h-[160px] max-h-[60vh] resize-none overflow-y-auto font-mono text-[13px] leading-relaxed"
        />
      </Card>

      {Boolean(error) && (
        <Alert variant="destructive">
          <AlertTitle>Query failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Card title="Results">
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading the FPL database…
          </p>
        </Card>
      ) : showResults && data ? (
        <Card
          title="Results"
          actions={
            <span className="text-xs tabular-nums text-muted-foreground">
              {data.length} {data.length === 1 ? 'row' : 'rows'}
            </span>
          }
        >
          <ResultSet data={data} />
        </Card>
      ) : showResults ? (
        <Card title="Results">
          <p className="py-8 text-center text-sm text-muted-foreground">
            The query returned no rows.
          </p>
        </Card>
      ) : null}
    </div>
  )
}

export default Dashboard
