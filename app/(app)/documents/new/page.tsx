import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { DocumentForm } from '@/components/documents/document-form'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { listSubjectOptions } from '@/lib/data/queries'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Nuevo documento' }

export default async function NewDocumentPage() {
  const user = await requireUser()
  const subjects = await listSubjectOptions(user.id)

  return (
    <div className="flex flex-col gap-2">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/documents">
          <ArrowLeft data-icon="inline-start" />
          Documentos
        </Link>
      </Button>
      <PageHeader title="Nuevo documento" description="Escribí en Markdown; se guarda solo para vos." />
      <DocumentForm subjects={subjects} />
    </div>
  )
}
