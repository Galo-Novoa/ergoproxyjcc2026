'use client'

import { FileText, Trash2, Upload, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { deleteFile, getFileText, uploadFile } from '@/app/actions/files'
import { SUPPORTED_TYPES } from '@/lib/files/types'

export type FileRow = {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

const ACCEPT = '.pdf,.docx,.txt,.md'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const dateFormat = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' })

export function FilesView({ subjectId, files }: { subjectId: string; files: FileRow[] }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState<{ title: string; text: string } | null>(null)

  function upload(selected: FileList | null) {
    const file = selected?.[0]
    if (!file || pending) return

    const formData = new FormData()
    formData.set('file', file)

    startTransition(async () => {
      const result = await uploadFile(subjectId, formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        `"${file.name}" cargado: ${result.data?.chars.toLocaleString('es-AR')} caracteres de texto listos para preguntar.`,
      )
      if (inputRef.current) inputRef.current.value = ''
      router.refresh()
    })
  }

  function remove(id: string, name: string) {
    startTransition(async () => {
      const result = await deleteFile(id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`"${name}" eliminado.`)
      router.refresh()
    })
  }

  function read(id: string) {
    startTransition(async () => {
      const result = await getFileText(id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      if (result.data) setReading(result.data)
    })
  }

  return (
    <section className="files-view">
      <div className="files-heading">
        <div>
          <div className="eyebrow">MATERIAL DE LA MATERIA</div>
          <h2>Archivos de la materia</h2>
          <p>
            Subí apuntes, guías y parciales. Guardamos el texto para que el tutor responda sobre tu
            material.
          </p>
        </div>
        <button
          type="button"
          className="button primary"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
        >
          <Upload size={16} /> {pending ? 'Procesando…' : 'Subir archivo'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => upload(event.target.files)}
      />

      <button
        type="button"
        className={`drop-zone ${dragging ? 'is-dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          upload(event.dataTransfer.files)
        }}
      >
        <Upload size={22} />
        <strong>Arrastrá tus archivos acá</strong>
        <span>o hacé click para elegirlos · {Object.values(SUPPORTED_TYPES).join(', ')} · hasta 10 MB</span>
      </button>

      {files.length === 0 ? (
        <p className="sessions-empty" style={{ marginTop: 24 }}>
          Todavía no subiste material a esta materia.
        </p>
      ) : (
        <div className="file-list">
          <div className="file-list-head">
            <span>ARCHIVO</span>
            <span>TIPO</span>
            <span>TAMAÑO</span>
            <span>FECHA</span>
            <span />
          </div>
          {files.map((file) => (
            <div className="file-row" key={file.id}>
              <button type="button" className="file-name" onClick={() => read(file.id)}>
                <div className="file-icon">
                  <FileText size={17} />
                </div>
                <strong>{file.name}</strong>
              </button>
              <span>
                {SUPPORTED_TYPES[file.mimeType as keyof typeof SUPPORTED_TYPES] ?? 'Archivo'}
              </span>
              <span>{formatSize(file.sizeBytes)}</span>
              <span>{dateFormat.format(new Date(file.createdAt))}</span>
              <button
                type="button"
                className="delete-button"
                aria-label={`Eliminar ${file.name}`}
                onClick={() => remove(file.id, file.name)}
                disabled={pending}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {reading && (
        <div className="modal-backdrop" onPointerDown={() => setReading(null)}>
          <div
            className="modal reader"
            role="dialog"
            aria-modal="true"
            aria-label={reading.title}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="close-modal"
              aria-label="Cerrar"
              onClick={() => setReading(null)}
            >
              <X size={18} />
            </button>
            <div className="eyebrow">TEXTO EXTRAÍDO</div>
            <h2>{reading.title}</h2>
            <pre className="reader-text">{reading.text}</pre>
          </div>
        </div>
      )}
    </section>
  )
}
