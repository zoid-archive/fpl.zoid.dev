'use client'

interface Props {
  lastUpdated?: string
}

export const Credit = ({ lastUpdated }: Props) => {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
      <span>Data from</span>
      <a
        href="https://github.com/vaastav/Fantasy-Premier-League"
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground/80 underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:text-foreground hover:decoration-muted-foreground"
      >
        vaastav/Fantasy-Premier-League
      </a>
      <span aria-hidden="true">·</span>
      <span>
        Source revision dated:{' '}
        <span className="font-medium tabular-nums text-foreground/80">
          {lastUpdated
            ? new Date(lastUpdated).toISOString().slice(0, 10)
            : 'loading…'}
        </span>
      </span>
    </p>
  )
}
