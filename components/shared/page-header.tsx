import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  actions,
  badge,
}: {
  title: string
  description?: string
  actions?: ReactNode
  badge?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">{title}</h1>
          {badge}
        </div>
        {description ? (
          <p className="max-w-2xl text-pretty text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}
