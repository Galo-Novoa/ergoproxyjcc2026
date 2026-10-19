import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteDocument } from '@/app/actions/documents'
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getDocument } from '@/lib/data/queries'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Documento' }

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()
  const doc = await getDocument(user.id, id)
  if (!doc) notFound()

  async function remove() {
    'use server'
    return deleteDocument(id)
  }

  return (
    <div className="flex flex-col gap-2">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/documents">
          <ArrowLeft data-icon="inline-start" />
          Documentos
        </Link>
      </Button>
      <PageHeader
        title={doc.title}
        badge={
          <>
            <Badge variant="outline">{doc.kind === 'summary' ? 'Resumen' : 'Nota'}</Badge>
            {doc.subjectName ? <Badge variant="secondary">{doc.subjectName}</Badge> : null}
          </>
        }
        actions={
          <ConfirmDeleteButton
            title="¿Eliminar este documento?"
            description="Esta acción no se puede deshacer."
            successMessage="Documento eliminado."
            redirectTo="/documents"
            onConfirm={remove}
          />
        }
      />
      <article className="max-w-3xl rounded-xl border bg-card p-6">
        {doc.contentMd.trim() ? (
          <pre className="font-sans text-base leading-relaxed whitespace-pre-wrap">{doc.contentMd}</pre>
        ) : (
          <p className="text-muted-foreground">Este documento no tiene contenido.</p>
        )}
      </article>
    </div>
  )
}
