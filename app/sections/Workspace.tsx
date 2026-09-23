'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { resolveSeason } from '../lib/seasons'
import Dashboard from './Dashboard'
import { SidePanel } from './SidePanel'

interface Props {
  name?: string
  description?: string
  queryFromDatabase?: string
  seasonBinding?: string
}

function SeasonWorkspace({ seasonBinding = 'current', ...props }: Props) {
  const params = useSearchParams()
  const season = resolveSeason(params.get('season') || seasonBinding)
  const selectSeason = (next: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('season', next)
    window.history.pushState(null, '', url)
  }

  return (
    <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-4 lg:gap-6">
      <div className="min-w-0 lg:col-span-3">
        <Dashboard
          {...props}
          season={season}
          seasonBinding={seasonBinding}
          onSeasonChange={selectSeason}
        />
      </div>
      <div className="min-w-0 self-start space-y-4 lg:sticky lg:top-6 lg:col-span-1">
        <SidePanel season={season} />
      </div>
    </div>
  )
}

export default function Workspace(props: Props) {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading workspace…</p>
      }
    >
      <SeasonWorkspace {...props} />
    </Suspense>
  )
}
