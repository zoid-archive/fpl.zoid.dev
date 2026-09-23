import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface Props {
  children: ReactNode
  title?: string
  description?: string
  actions?: ReactNode
  className?: string
  contentClassName?: string
}

export const Card = ({
  children,
  title,
  description,
  actions,
  className,
  contentClassName,
}: Props) => {
  const showHeader = Boolean(title || description || actions)

  return (
    <section
      className={cn(
        'w-full rounded-lg border bg-card text-card-foreground shadow-sm',
        className,
      )}
    >
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
      )}
      <div className={cn('p-4', contentClassName)}>{children}</div>
    </section>
  )
}
