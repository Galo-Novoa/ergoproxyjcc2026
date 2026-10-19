'use client'

import { upload } from '@vercel/blob/client'
import { FileUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { createFileRecord, deleteFile, finalizeUpload } from '@/app/actions/files'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { MAX_FILE_SIZE_BYTES } from '@/lib/files/constants'

type SubjectOption = { id: string; name: string }

type Props = {
  // Materia fija (página de una materia). Si se omite, se usa el selector o General.
  subjectId?: string
  // Con esta lista se muestra un selector de destino.
  subjects?: SubjectOption[]
  label?: string
  variant?: React.ComponentProps<typeof Button>['variant']
}

function isPdf(file: File) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

export function FileUploadButton({
  subjectId,
  subjects,
  label = 'Subir PDF',
  variant = 'default',
}: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [destination, setDestination] = useState('none')
  const [progress, setProgress] = useState<string | null>(null)
  const busy = progress !== null

  async function uploadOne(file: File, targetSubjectId: string) {
    if (!isPdf(file)) {
      toast.error(`${file.name}: solo se admiten archivos PDF.`)
      return
    }
    if (file.size === 0) {
      toast.error(`${file.name}: el archivo está vacío.`)
      return
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`${file.name}: supera el máximo de 25 MB.`)
      return
    }

    const created = await createFileRecord({
      name: file.name,
      mimeType: 'application/pdf',
      sizeBytes: file.size,
      subjectId: targetSubjectId,
    })
    if (!created.ok || !created.data) {
      toast.error(created.ok ? 'No pudimos iniciar la subida.' : created.error)
      return
    }
    const { id, pathname } = created.data

    try {
      await upload(pathname, file, {
        access: 'private',
        handleUploadUrl: '/api/files/upload',
        contentType: 'application/pdf',
      })
    } catch (error) {
      console.error('[files] upload failed', error)
      await deleteFile(id)
      toast.error(`${file.name}: no se pudo subir. Probá de nuevo.`)
      return
    }

    const finalized = await finalizeUpload(id)
    if (!finalized.ok) {
      toast.error(`${file.name}: ${finalized.error}`)
      router.refresh()
      return
    }

    // Aparece en la lista como "Procesando" mientras se extrae el texto.
    router.refresh()
    const response = await fetch(`/api/files/${id}/process`, { method: 'POST' })
    const body = (await response.json().catch(() => null)) as {
      status?: string
      error?: string
    } | null
    if (!response.ok) {
      toast.error(`${file.name}: ${body?.error ?? 'no se pudo procesar.'}`)
    } else if (body?.status === 'needs_ocr') {
      toast.warning(`${file.name}: no tiene texto seleccionable (parece escaneado).`)
    } else {
      toast.success(`${file.name} está listo.`)
    }
    router.refresh()
  }

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return

    const target = subjectId ?? destination
    for (const [index, file] of files.entries()) {
      setProgress(files.length > 1 ? `Subiendo ${index + 1} de ${files.length}…` : 'Subiendo…')
      try {
        await uploadOne(file, target)
      } catch (error) {
        console.error('[files] upload flow failed', error)
        toast.error(`${file.name}: ocurrió un error inesperado.`)
      }
    }
    setProgress(null)
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {subjects && !subjectId ? (
        <Select value={destination} onValueChange={setDestination} disabled={busy}>
          <SelectTrigger className="w-52" aria-label="Materia de destino">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">General (sin materia)</SelectItem>
            {subjects.map((subject) => (
              <SelectItem key={subject.id} value={subject.id}>
                {subject.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={handleFiles}
        aria-hidden="true"
      />
      <Button variant={variant} onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? <Spinner data-icon="inline-start" /> : <FileUp data-icon="inline-start" />}
        {progress ?? label}
      </Button>
    </div>
  )
}
