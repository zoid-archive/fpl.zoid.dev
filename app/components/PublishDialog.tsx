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
import { useElectric } from 'app/Providers'
import { createStrategy } from 'app/actions/createStrategy'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import slugify from 'slugify'

interface Props {
  query: string
}

export const PublishDialog = ({ query }: Props) => {
  const electric = useElectric()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)

  const id = slugify(name, { lower: true })
  const strategyUrl = origin ? `${origin}/strategy/${id}` : `/strategy/${id}`

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  if (!electric) {
    return null
  }

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
      await createStrategy(id, name, description, query)
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish your strategy</DialogTitle>
          <DialogDescription>
            Name your query — anyone with the link below can open and run it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
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
          <div className="grid items-center grid-cols-4 gap-4">
            <Label htmlFor="strategy-name" className="text-right">
              Name
            </Label>
            <Input
              id="strategy-name"
              placeholder="e.g. Budget keepers"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
              }}
              className="col-span-3"
            />
          </div>
          <div className="grid items-center grid-cols-4 gap-4">
            <Label htmlFor="strategy-description" className="text-right">
              Description
            </Label>
            <Input
              id="strategy-description"
              placeholder="What does this query find?"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
              }}
              className="col-span-3"
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
