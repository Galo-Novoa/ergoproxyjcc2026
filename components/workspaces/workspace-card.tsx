'use client'

import { Lock, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { deleteSubject } from '@/app/actions/subjects'
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-button'
import { SubjectDialog } from '@/components/subjects/subject-form-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { pluralize } from '@/lib/format'
import { cn } from '@/lib/utils'
import { getWorkspaceColor, getWorkspaceIcon, GeneralIcon } from '@/lib/workspace'

export type WorkspaceItem = {
  id: string
  href: string
  name: string
  code: string | null
  description: string | null
  color: string
  icon: string
  fileCount: number
  activityLabel: string | null
  activityTs: number | null
  isGeneral: boolean
}

export function WorkspaceCard({ item }: { item: WorkspaceItem }) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const color = getWorkspaceColor(item.color)
  const Icon = item.isGeneral ? GeneralIcon : getWorkspaceIcon(item.icon)

  return (
    <li
      className={cn(
        'group relative flex aspect-[4/3] flex-col justify-between rounded-2xl border p-5 transition-shadow focus-within:ring-3 focus-within:ring-ring/50 hover:shadow-md sm:aspect-square',
        item.isGeneral ? 'border-border bg-secondary' : color.card,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-12 items-center justify-center rounded-xl text-primary-foreground',
            item.isGeneral ? 'bg-primary' : color.tile,
          )}
        >
          <Icon className="size-6" />
        </span>

        {item.isGeneral ? (
          <Badge variant="secondary" className="relative z-10 gap-1">
            <Lock className="size-3" aria-hidden="true" />
            Fijo
          </Badge>
        ) : (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative z-10"
                  aria-label={`Acciones de ${item.name}`}
                >
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                    <Pencil />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                    <Trash2 />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <SubjectDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              subject={{
                id: item.id,
                name: item.name,
                code: item.code,
                description: item.description,
                color: item.color,
                icon: item.icon,
              }}
            />
            <ConfirmDeleteDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              title={`¿Eliminar "${item.name}"?`}
              description="Se elimina la materia. Sus archivos, conversaciones y documentos se conservan y pasan al workspace General."
              successMessage="Materia eliminada."
              onConfirm={() => deleteSubject(item.id)}
            />
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {item.code ? (
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {item.code}
            </span>
          ) : null}
          <h2 className="line-clamp-2 text-xl leading-snug font-semibold text-balance">
            <Link
              href={item.href}
              className="outline-none after:absolute after:inset-0 after:rounded-2xl after:content-['']"
            >
              {item.name}
            </Link>
          </h2>
          {item.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
          ) : null}
        </div>
        <dl className="flex flex-col gap-0.5 text-sm text-muted-foreground">
          <div className="flex gap-1.5">
            <dt className="sr-only">Archivos</dt>
            <dd>{pluralize(item.fileCount, 'archivo', 'archivos')}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Actividad:</dt>
            <dd>{item.activityLabel ?? 'sin actividad'}</dd>
          </div>
        </dl>
      </div>
    </li>
  )
}
