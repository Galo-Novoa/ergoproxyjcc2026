import { ArrowLeft, FileText, Files, MessagesSquare } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteSubject } from '@/app/actions/subjects'
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { SubjectFormDialog } from '@/components/subjects/subject-form-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  getSubject,
  listConversations,
  listDocuments,
  listFiles,
} from '@/lib/data/queries'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Materia' }

export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()
  const subject = await getSubject(user.id, id)
  if (!subject) notFound()

  const [files, conversations, documents] = await Promise.all([
    listFiles(user.id, id),
    listConversations(user.id, id),
    listDocuments(user.id, id),
  ])

  async function remove() {
    'use server'
    return deleteSubject(id)
  }

  return (
    <div className="flex flex-col gap-2">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/subjects">
          <ArrowLeft data-icon="inline-start" />
          Materias
        </Link>
      </Button>

      <PageHeader
        title={subject.name}
        description={subject.description ?? undefined}
        badge={subject.code ? <Badge variant="outline">{subject.code}</Badge> : undefined}
        actions={
          <>
            <SubjectFormDialog subject={subject} />
            <ConfirmDeleteButton
              title="¿Eliminar esta materia?"
              description="Se elimina la materia. Sus archivos, conversaciones y documentos se conservan, pero quedan sin materia asignada."
              successMessage="Materia eliminada."
              redirectTo="/subjects"
              onConfirm={remove}
            />
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Files className="size-4" /> Archivos
            </CardTitle>
            <CardDescription>{files.length} en esta materia</CardDescription>
          </CardHeader>
          <CardContent>
            {files.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin archivos todavía.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {files.slice(0, 5).map((f) => (
                  <li key={f.id} className="truncate">
                    {f.name}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessagesSquare className="size-4" /> Conversaciones
            </CardTitle>
            <CardDescription>{conversations.length} en esta materia</CardDescription>
          </CardHeader>
          <CardContent>
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin conversaciones todavía.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {conversations.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link href={`/chat/${c.id}`} className="underline-offset-4 hover:underline">
                      {c.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" /> Documentos
            </CardTitle>
            <CardDescription>{documents.length} en esta materia</CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin documentos todavía.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {documents.slice(0, 5).map((d) => (
                  <li key={d.id}>
                    <Link href={`/documents/${d.id}`} className="underline-offset-4 hover:underline">
                      {d.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {files.length + conversations.length + documents.length === 0 ? (
        <div className="pt-4">
          <EmptyState
            icon={MessagesSquare}
            title="Esta materia está vacía"
            description="Empezá una conversación o escribí una nota y asignala a esta materia."
          >
            <Button asChild>
              <Link href="/chat">Ir a conversaciones</Link>
            </Button>
          </EmptyState>
        </div>
      ) : null}
    </div>
  )
}
