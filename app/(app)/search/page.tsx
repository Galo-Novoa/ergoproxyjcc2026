import { Search, SearchX } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { searchAll } from '@/lib/data/queries'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Búsqueda' }

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const user = await requireUser()
  const { q } = await searchParams
  const query = (Array.isArray(q) ? q[0] : q)?.slice(0, 100).trim() ?? ''
  const results = await searchAll(user.id, query)
  const total =
    results.subjects.length +
    results.files.length +
    results.documents.length +
    results.conversations.length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Búsqueda"
        description="Buscá por nombre en tus materias, archivos, documentos y conversaciones."
      />

      <form role="search" action="/search" className="flex max-w-xl gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Ej: derivadas, parcial, MAT-201"
          aria-label="Texto a buscar"
          maxLength={100}
        />
        <Button type="submit">
          <Search data-icon="inline-start" />
          Buscar
        </Button>
      </form>

      {!query ? (
        <EmptyState
          icon={Search}
          title="Escribí qué querés encontrar"
          description="Los resultados aparecen agrupados por tipo."
        />
      ) : total === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Sin resultados"
          description={`No encontramos nada para "${query}". Probá con otra palabra.`}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <ResultCard title="Materias" count={results.subjects.length}>
            {results.subjects.map((s) => (
              <Link key={s.id} href={`/subjects/${s.id}`} className="hover:underline">
                {s.name}
                {s.code ? <span className="text-muted-foreground"> · {s.code}</span> : null}
              </Link>
            ))}
          </ResultCard>
          <ResultCard title="Archivos" count={results.files.length}>
            {results.files.map((f) => (
              <Link
                key={f.id}
                href={f.subjectId ? `/subjects/${f.subjectId}` : '/general'}
                className="hover:underline"
              >
                {f.name}
              </Link>
            ))}
          </ResultCard>
          <ResultCard title="Documentos" count={results.documents.length}>
            {results.documents.map((d) => (
              <Link key={d.id} href={`/documents/${d.id}`} className="hover:underline">
                {d.title}
              </Link>
            ))}
          </ResultCard>
          <ResultCard title="Conversaciones" count={results.conversations.length}>
            {results.conversations.map((c) => (
              <Link key={c.id} href={`/chat/${c.id}`} className="hover:underline">
                {c.title}
              </Link>
            ))}
          </ResultCard>
        </div>
      )}
    </div>
  )
}

function ResultCard({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  if (count === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{count} resultados</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2 text-sm">
          {Array.isArray(children)
            ? children.map((child, index) => <li key={index}>{child}</li>)
            : null}
        </ul>
      </CardContent>
    </Card>
  )
}
