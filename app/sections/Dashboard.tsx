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
import {
  FPL_DB_PATH,
  SQL_WASM_WASM_PATH,
  manifest,
  resolveSeason,
  seasonLabel,
} from '../lib/seasons'

interface Props {
  name?: string
  description?: string
  queryFromDatabase?: string
  season: string
  seasonBinding: string
  onSeasonChange: (season: string) => void
}

function Dashboard({
  name,
  description,
  queryFromDatabase,
  season,
  seasonBinding,
  onSeasonChange,
}: Props) {
  const initialQuery = queryFromDatabase || getDefaultQuery()
  const [queryDraft, setQueryDraft] = useState<string>(initialQuery)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const selectedSeason = manifest.seasons.find(
    (entry) => entry.season === season,
  )

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
    season,
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
          <p className="mt-2 text-xs text-muted-foreground">
            Saved for{' '}
            {seasonBinding === 'current'
              ? 'the current season (follows rollover)'
              : seasonBinding}
            .
            {season !== resolveSeason(seasonBinding) &&
              ' Exploring another season — saved strategy unchanged.'}
          </p>
        </div>
      )}

      <div className="space-y-2 rounded-lg border bg-muted/30 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label htmlFor="season" className="text-sm font-medium">
            Season
          </label>
          <select
            id="season"
            value={season}
            onChange={(event) => onSeasonChange(event.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {!selectedSeason && (
              <option value={season}>{seasonLabel(season)}</option>
            )}
            {manifest.seasons.map((entry) => (
              <option key={entry.season} value={entry.season}>
                {seasonLabel(entry.season)}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            Cumulative totals
            {selectedSeason?.status === 'partial'
              ? ' · Partial season'
              : selectedSeason
                ? ' · Completed season'
                : ''}
          </span>
        </div>
        {selectedSeason && (
          <Credit lastUpdated={selectedSeason.sourceUpdatedAt} />
        )}
        <p className="text-xs text-muted-foreground">
          <code>players</code> uses this season. <code>player_seasons</code>{' '}
          always includes all seasons.
        </p>
      </div>

      <Card
        title="Query"
        actions={
          <ActionButtons
            queryDraft={queryDraft}
            setQueryDraft={setQueryDraft}
            setQuery={setQuery}
            running={running}
            season={season}
            canPublish={Boolean(selectedSeason)}
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
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <span className="text-muted-foreground">Try a query:</span>
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => setQueryDraft(getDefaultQuery())}
          >
            Top goalkeepers
          </button>
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() =>
              setQueryDraft(
                `SELECT\n  season,\n  COUNT(*) AS players,\n  MAX(total_points) AS highest_score\nFROM player_seasons\nGROUP BY season\nORDER BY season DESC;`,
              )
            }
          >
            Compare seasons
          </button>
          <span className="text-muted-foreground">
            Examples replace the draft; execute when ready.
          </span>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Partial and completed seasons are not like-for-like. Scoring rules may
        differ; prices and ownership are snapshot values. Names are not
        cross-season player IDs.
      </p>

      {Boolean(error) && (
        <Alert variant="destructive">
          <AlertTitle>Query failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Card title={`Results · players: ${season}`}>
          <p className="py-8 text-center text-sm text-muted-foreground">
            Running query for {season}…
          </p>
        </Card>
      ) : showResults && data ? (
        <Card
          title={`Results · players: ${season}`}
          actions={
            <span className="text-xs tabular-nums text-muted-foreground">
              {data.length} {data.length === 1 ? 'row' : 'rows'}
            </span>
          }
        >
          <ResultSet data={data} />
        </Card>
      ) : showResults ? (
        <Card title={`Results · players: ${season}`}>
          <p className="py-8 text-center text-sm text-muted-foreground">
            The query returned no rows.
          </p>
        </Card>
      ) : null}
    </div>
  )
}

export default Dashboard
