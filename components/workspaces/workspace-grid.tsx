'use client'

import { BookOpen, Search, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState } from '@/components/shared/empty-state'
import { SubjectFormDialog } from '@/components/subjects/subject-form-dialog'
import { SubjectImportDialog } from '@/components/subjects/subject-import-dialog'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { WorkspaceCard, type WorkspaceItem } from './workspace-card'

type SortKey = 'recent' | 'name' | 'files'

const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Actividad reciente',
  name: 'Nombre (A–Z)',
  files: 'Más archivos',
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** General va siempre primero y no se ordena ni se filtra por actividad. */
export function WorkspaceGrid({
  general,
  subjects,
}: {
  general?: WorkspaceItem
  subjects: WorkspaceItem[]
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')

  const visible = useMemo(() => {
    const term = normalize(query.trim())
    const filtered = term
      ? subjects.filter((s) => normalize(`${s.name} ${s.code ?? ''}`).includes(term))
      : subjects
    return [...filtered].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'es')
      if (sort === 'files') return b.fileCount - a.fileCount || a.name.localeCompare(b.name, 'es')
      return (b.activityTs ?? 0) - (a.activityTs ?? 0) || a.name.localeCompare(b.name, 'es')
    })
  }, [subjects, query, sort])

  const hasSubjects = subjects.length > 0

  return (
    <div className="flex flex-col gap-6">
      {hasSubjects ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <InputGroup className="sm:max-w-sm">
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar materia o código"
              aria-label="Buscar materias"
            />
          </InputGroup>
          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger className="sm:w-52" aria-label="Ordenar materias">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {SORT_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground sm:ml-auto" aria-live="polite">
            {visible.length} de {subjects.length} {subjects.length === 1 ? 'materia' : 'materias'}
          </p>
        </div>
      ) : null}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {general ? <WorkspaceCard item={general} /> : null}
        {visible.map((item) => (
          <WorkspaceCard key={item.id} item={item} />
        ))}
      </ul>

      {!hasSubjects ? (
        <EmptyState
          icon={BookOpen}
          title="Todavía no creaste ninguna materia"
          description="Creá tu primera materia o importá el listado de tu plan de estudios. Mientras tanto, podés usar General para lo que todavía no tiene materia."
        >
          <div className="flex flex-wrap justify-center gap-2">
            <SubjectFormDialog />
            <SubjectImportDialog />
          </div>
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Ninguna materia coincide"
          description={`No encontramos materias para "${query.trim()}".`}
        >
          <Button variant="outline" onClick={() => setQuery('')}>
            Limpiar búsqueda
          </Button>
        </EmptyState>
      ) : null}
    </div>
  )
}
