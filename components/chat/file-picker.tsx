'use client'

import { Paperclip, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type ChatFile = { id: string; name: string; subjectName: string | null }

export function FilePicker({
  files,
  selectedIds,
  onChange,
  disabled,
}: {
  files: ChatFile[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  const selected = files.filter((f) => selectedIds.includes(f.id))

  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...selectedIds, id] : selectedIds.filter((s) => s !== id))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={disabled || files.length === 0}>
            <Paperclip data-icon="inline-start" />
            {selected.length ? `Documentos (${selected.length})` : 'Elegir documentos'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-72 overflow-y-auto">
          <DropdownMenuLabel>Consultar solo estos archivos</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {files.map((file) => (
            <DropdownMenuCheckboxItem
              key={file.id}
              checked={selectedIds.includes(file.id)}
              onCheckedChange={(checked) => toggle(file.id, checked === true)}
              onSelect={(event) => event.preventDefault()}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{file.name}</span>
                {file.subjectName ? (
                  <span className="truncate text-xs text-muted-foreground">{file.subjectName}</span>
                ) : null}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {selected.length === 0 ? (
        <span className="text-xs text-muted-foreground">
          {files.length === 0
            ? 'Todavía no hay documentos indexados.'
            : 'Sin selección: se consultan todos tus documentos.'}
        </span>
      ) : (
        selected.map((file) => (
          <Badge key={file.id} variant="secondary" className="max-w-48 gap-1">
            <span className="truncate">{file.name}</span>
            <button
              type="button"
              onClick={() => toggle(file.id, false)}
              disabled={disabled}
              aria-label={`Quitar ${file.name}`}
              className="rounded-full hover:text-foreground"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </Badge>
        ))
      )}
    </div>
  )
}
