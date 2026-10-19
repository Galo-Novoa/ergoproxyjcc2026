import { FileText, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { listDocuments } from '@/lib/data/queries'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Documentos' }

const dateFormat = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })

export default async function DocumentsPage() {
  const user = await requireUser()
  const documents = await listDocuments(user.id)

  const newButton = (
    <Button asChild>
      <Link href="/documents/new">
        <Plus data-icon="inline-start" />
        Nuevo documento
      </Link>
    </Button>
  )

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Documentos"
        description="Resúmenes y notas propias para repasar antes de cada examen."
        actions={newButton}
      />

      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Todavía no escribiste documentos"
          description="Guardá tus resúmenes y conclusiones para tenerlos a mano."
        >
          {newButton}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {documents.map((d) => (
            <li key={d.id}>
              <Link
                href={`/documents/${d.id}`}
                className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Card className="flex-row items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/60">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{d.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {d.kind === 'summary' ? 'Resumen' : 'Nota'} · {dateFormat.format(d.updatedAt)}
                    </span>
                  </div>
                  {d.subjectName ? <Badge variant="secondary">{d.subjectName}</Badge> : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
