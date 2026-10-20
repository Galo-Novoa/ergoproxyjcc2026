'use client'

import { ArrowUpRight, Folder, Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createSubject } from '@/app/actions/subjects'
import { formatRelative, pluralize } from '@/lib/format'
import { COLOR_KEYS, DEFAULT_ICON } from '@/lib/workspace'

export type SubjectCard = {
  id: string
  name: string
  color: string
  fileCount: number
  conversationCount: number
  lastActivityAt: string
}

export function SubjectGrid({ subjects }: { subjects: SubjectCard[] }) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [pending, startTransition] = useTransition()

  function submit() {
    const trimmed = name.trim()
    if (!trimmed || pending) return

    // El color rota según cuántas materias haya, para que la grilla no quede toda igual.
    const formData = new FormData()
    formData.set('name', trimmed)
    formData.set('code', '')
    formData.set('description', '')
    formData.set('color', COLOR_KEYS[subjects.length % COLOR_KEYS.length])
    formData.set('icon', DEFAULT_ICON)

    startTransition(async () => {
      const result = await createSubject(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setName('')
      setModalOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <div className="subject-grid">
        <button type="button" className="new-subject-card" onClick={() => setModalOpen(true)}>
          <span>
            <Plus size={21} />
          </span>
          <strong>Nueva materia</strong>
          <small>Empezá a organizar</small>
        </button>
        {subjects.map((subject) => (
          <button
            key={subject.id}
            type="button"
            className="subject-card"
            onClick={() => router.push(`/subjects/${subject.id}`)}
          >
            <div className={`subject-icon ${subject.color}`}>
              {subject.name.trim()[0]?.toUpperCase() ?? '·'}
            </div>
            <div className="subject-info">
              <strong>{subject.name}</strong>
              <span>
                {subject.conversationCount === 0
                  ? 'Sin sesiones'
                  : pluralize(subject.conversationCount, 'sesión', 'sesiones')}
              </span>
            </div>
            <div className="card-arrow">
              <ArrowUpRight size={17} />
            </div>
            <div className="card-footer">
              <span>
                <Folder size={13} /> {pluralize(subject.fileCount, 'archivo', 'archivos')}
              </span>
              <span>{formatRelative(new Date(subject.lastActivityAt))}</span>
            </div>
          </button>
        ))}
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onPointerDown={() => setModalOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nueva-materia"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="close-modal"
              aria-label="Cerrar"
              onClick={() => setModalOpen(false)}
            >
              <X size={18} />
            </button>
            <div className="modal-icon">
              <Plus size={20} />
            </div>
            <h2 id="nueva-materia">Crear nueva materia</h2>
            <p>Organizá tus sesiones y materiales por materia.</p>
            <input
              autoFocus
              placeholder="Nombre de la materia"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
                if (event.key === 'Escape') setModalOpen(false)
              }}
            />
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button primary"
                onClick={submit}
                disabled={pending || name.trim().length === 0}
              >
                {pending ? 'Creando…' : 'Crear materia'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
