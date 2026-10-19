'use client'

import { FileText, RotateCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { deleteFile, setFileKind } from '@/app/actions/files'
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import {
  FILE_KIND_LABEL,
  FILE_STATUS_LABEL,
  formatFileSize,
  type FileStatus,
} from '@/lib/files/constants'
import type { FileItem } from '@/lib/files/view'

const STATUS_VARIANT: Record<FileStatus, 'secondary' | 'outline' | 'destructive'> = {
  uploading: 'outline',
  processing: 'outline',
  ready: 'secondary',
  needs_ocr: 'outline',
  failed: 'destructive',
}

function describeFile(file: FileItem) {
  const parts = [formatFileSize(file.sizeBytes)]
  if (file.pageCount) {
    parts.push(`${file.pageCount} ${file.pageCount === 1 ? 'página' : 'páginas'}`)
  }
  if (file.subjectName) parts.push(file.subjectName)
  parts.push(file.createdLabel)
  return parts.join(' · ')
}

function FileRow({ file }: { file: FileItem }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [retrying, setRetrying] = useState(false)
  const busy = file.status === 'uploading' || file.status === 'processing'
  const canRetry = file.status === 'failed' || (file.status === 'processing' && file.stale)

  function handleKindChange(value: string) {
    startTransition(async () => {
      const result = await setFileKind(file.id, value as 'theory' | 'practice' | 'none')
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  async function handleRetry() {
    setRetrying(true)
    try {
      const response = await fetch(`/api/files/${file.id}/process`, { method: 'POST' })
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) toast.error(body?.error ?? 'No se pudo procesar el archivo.')
      else toast.success('Archivo procesado.')
    } finally {
      setRetrying(false)
      router.refresh()
    }
  }

  async function handleDelete() {
    return deleteFile(file.id)
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="flex min-w-0 flex-col">
            {file.status === 'uploading' ? (
              <span className="truncate font-medium">{file.name}</span>
            ) : (
              <a
                href={`/api/files/${file.id}/download`}
                target="_blank"
                rel="noreferrer"
                className="truncate font-medium underline-offset-4 hover:underline"
              >
                {file.name}
              </a>
            )}
            <span className="truncate text-sm text-muted-foreground">{describeFile(file)}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={STATUS_VARIANT[file.status]}>
            {busy || retrying ? <Spinner data-icon="inline-start" /> : null}
            {file.status === 'uploading' && file.stale
              ? 'Carga incompleta'
              : FILE_STATUS_LABEL[file.status]}
          </Badge>
          <ConfirmDeleteButton
            iconOnly
            label={`Eliminar ${file.name}`}
            title="¿Eliminar este archivo?"
            description="Se borra el PDF y el texto extraído. No se puede deshacer."
            successMessage="Archivo eliminado."
            onConfirm={handleDelete}
          />
        </div>
      </div>

      {file.status === 'ready' || file.status === 'needs_ocr' ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-7">
          <Select
            value={file.kind ?? 'none'}
            onValueChange={handleKindChange}
            disabled={pending}
          >
            <SelectTrigger size="sm" className="w-40" aria-label="Tipo de archivo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin clasificar</SelectItem>
              <SelectItem value="theory">{FILE_KIND_LABEL.theory}</SelectItem>
              <SelectItem value="practice">{FILE_KIND_LABEL.practice}</SelectItem>
            </SelectContent>
          </Select>
          {file.kindReason ? (
            <span className="text-sm text-muted-foreground">{file.kindReason}</span>
          ) : null}
        </div>
      ) : null}

      {file.status === 'needs_ocr' ? (
        <p className="pl-7 text-sm text-muted-foreground">
          Este PDF no tiene texto seleccionable (parece escaneado), así que todavía no se puede
          usar en el chat. El reconocimiento de texto (OCR) aún no está disponible.
        </p>
      ) : null}

      {file.status === 'failed' && file.errorMessage ? (
        <p className="pl-7 text-sm text-destructive">{file.errorMessage}</p>
      ) : null}

      {file.status === 'uploading' && file.stale ? (
        <p className="pl-7 text-sm text-muted-foreground">
          La carga se interrumpió. Eliminá el archivo y volvé a subirlo.
        </p>
      ) : null}

      {canRetry ? (
        <div className="pl-7">
          <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying}>
            <RotateCw data-icon="inline-start" />
            Reintentar procesamiento
          </Button>
        </div>
      ) : null}
    </li>
  )
}

export function FileList({ files }: { files: FileItem[] }) {
  const router = useRouter()
  const hasProcessing = files.some((file) => file.status === 'processing' && !file.stale)

  // Refresca mientras haya archivos procesándose para que el estado se actualice solo.
  useEffect(() => {
    if (!hasProcessing) return
    const timer = setInterval(() => router.refresh(), 4000)
    return () => clearInterval(timer)
  }, [hasProcessing, router])

  return (
    <ul className="divide-y">
      {files.map((file) => (
        <FileRow key={file.id} file={file} />
      ))}
    </ul>
  )
}
