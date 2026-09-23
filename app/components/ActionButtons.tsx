import { Button } from '@/components/ui/button'
import { Effect } from 'effect'
import { Dispatch, SetStateAction } from 'react'

import { formatQuery } from '../lib/sql'
import { PublishDialog } from './PublishDialog'

interface ActionButtonsArgs {
  queryDraft: string
  setQueryDraft: Dispatch<SetStateAction<string>>
  setQuery: Dispatch<SetStateAction<string>>
  running?: boolean
}

export const ActionButtons = ({
  queryDraft,
  setQueryDraft,
  setQuery,
  running,
}: ActionButtonsArgs) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        onClick={() => {
          setQuery(queryDraft)
        }}
        disabled={running}
        title="Ctrl / ⌘ + Enter"
      >
        {running ? 'Running…' : 'Execute SQL'}
        <kbd className="ml-1 hidden rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1.5 py-0.5 text-[10px] font-medium sm:inline-block">
          Ctrl+↵
        </kbd>
      </Button>

      <Button
        variant="outline"
        onClick={() => {
          const query = Effect.runSync(formatQuery(queryDraft))
          setQueryDraft(query)
        }}
      >
        Format SQL
      </Button>

      <PublishDialog query={queryDraft}></PublishDialog>
    </div>
  )
}
