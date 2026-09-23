'use client'

interface Props {
  season: {
    source: string
    sourceURL: string
    sourceUpdatedAt: string | null
    capturedAt?: string
    dataChangedAt: string
    coverage?: {
      events: {
        id: number
        finished: boolean
        dataChecked: boolean
        isCurrent: boolean
      }[]
    }
  }
}

export const Credit = ({ season }: Props) => {
  const official = season.source === 'official'
  const events = season.coverage?.events
  const current = events?.find((event) => event.isCurrent)
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
      <span>Data from</span>
      <a
        href={season.sourceURL}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground/80 underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:text-foreground hover:decoration-muted-foreground"
      >
        {official
          ? 'Official Fantasy Premier League'
          : 'vaastav/Fantasy-Premier-League'}
      </a>
      <span aria-hidden="true">·</span>
      <span>
        {official ? 'Snapshot captured: ' : 'Source revision dated: '}
        <span className="font-medium tabular-nums text-foreground/80">
          {official
            ? season.capturedAt?.replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
            : season.sourceUpdatedAt?.slice(0, 10)}
        </span>
      </span>
      {official && (
        <span>
          · Player data changed:{' '}
          {season.dataChangedAt.replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}
        </span>
      )}
      {events && (
        <span>
          · API reports {events.filter((event) => event.finished).length}{' '}
          finished / {events.filter((event) => event.dataChecked).length}{' '}
          checked gameweeks
          {current &&
            ` · GW ${current.id}: ${current.finished && current.dataChecked ? 'finished and checked' : 'provisional totals'}`}
          {' · Totals may be revised'}
        </span>
      )}
    </p>
  )
}
