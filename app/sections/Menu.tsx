'use client'

import { ExternalLinkIcon } from '@radix-ui/react-icons'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

const externalLinks = [
  { href: 'https://twitter.com/divyenduz', label: 'Contact' },
  { href: 'https://github.com/divyenduz/fpl.zoid.dev', label: 'Source code' },
]

export const Menu = () => {
  const pathname = usePathname()
  const homeActive = pathname === '/'

  return (
    <header className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-[10px] font-bold tracking-tight text-primary-foreground">
          FPL
        </span>
        <span className="text-lg font-bold tracking-tight">FPL.lol</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          FPL data, meet SQL
        </span>
      </Link>

      <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Main">
        <Link
          href="/"
          aria-current={homeActive ? 'page' : undefined}
          className={cn(
            'rounded-md px-3 py-1.5 font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
            homeActive
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground',
          )}
        >
          Home
        </Link>

        {externalLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {link.label}
            <ExternalLinkIcon className="size-3.5 opacity-60" />
          </a>
        ))}
      </nav>
    </header>
  )
}
