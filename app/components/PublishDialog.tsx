import { CheckIcon, CopyIcon } from '@radix-ui/react-icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createStrategy } from 'app/actions/createStrategy'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import slugify from 'slugify'

interface Props {
  query: string
  season: string
}

export const PublishDialog = ({ query, season }: Props) => {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [copied, setCopied] = useState(false)
  const [seasonBinding, setSeasonBinding] = useState(season)

  const id = slugify(name, { lower: true })
  const strategyUrl =
    typeof window === 'undefined'
      ? `/strategy/${id}`
      : `${window.location.origin}/strategy/${id}`

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(strategyUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable — the URL is still selectable as text.
    }
  }

  const publish = async () => {
    setPublishing(true)
    setPublishError('')
    try {
      await createStrategy(id, name, description, query, seasonBinding)
      setIsOpen(false)
      router.push(`/strategy/${id}`)
    } catch (e) {
      console.error(e)
      setPublishError('Publishing failed — please try again.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Publish</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[95vw] grid-cols-1 overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>Publish your strategy</DialogTitle>
          <DialogDescription>
            Name your query — anyone with the link below can open and run it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-xs">
            {strategyUrl}
          </code>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={copyUrl}
            aria-label="Copy strategy URL"
            disabled={!id}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </div>

        <div className="grid gap-4 py-2">
          <div className="grid items-center gap-2 sm:grid-cols-4 sm:gap-4">
            <Label htmlFor="strategy-season" className="sm:text-right">
              Season
            </Label>
            <select
              id="strategy-season"
              value={seasonBinding}
              onChange={(event) => setSeasonBinding(event.target.value)}
              className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm sm:col-span-3"
            >
              <option value={season}>This season: {season}</option>
              <option value="current">Always current season</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            Sets the default for <code>players</code>; explicit season filters
            in SQL stay unchanged. A fixed season does not freeze its data.
          </p>
          <div className="grid items-center gap-2 sm:grid-cols-4 sm:gap-4">
            <Label htmlFor="strategy-name" className="sm:text-right">
              Name
            </Label>
            <Input
              id="strategy-name"
              placeholder="e.g. Budget keepers"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
              }}
              className="min-w-0 sm:col-span-3"
            />
          </div>
          <div className="grid items-center gap-2 sm:grid-cols-4 sm:gap-4">
            <Label htmlFor="strategy-description" className="sm:text-right">
              Description
            </Label>
            <Input
              id="strategy-description"
              placeholder="What does this query find?"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
              }}
              className="min-w-0 sm:col-span-3"
            />
          </div>
        </div>

        {Boolean(publishError) && (
          <p className="text-sm text-destructive">{publishError}</p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={publishing}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={publish} disabled={!id || publishing}>
            {publishing ? 'Publishing…' : 'Publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
