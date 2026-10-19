import { BookOpen } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { SubjectFormDialog } from '@/components/subjects/subject-form-dialog'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { listSubjects } from '@/lib/data/queries'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Materias' }

export default async function SubjectsPage() {
  const user = await requireUser()
  const subjects = await listSubjects(user.id)

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Materias"
        description="Cada materia reúne sus archivos, conversaciones y documentos."
        actions={<SubjectFormDialog />}
      />

      {subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Todavía no tenés materias"
          description="Creá la primera para empezar a organizar tu material de estudio."
        >
          <SubjectFormDialog />
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {subjects.map((subject) => (
            <li key={subject.id}>
              <Link
                href={`/subjects/${subject.id}`}
                className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Card className="h-full transition-colors hover:bg-muted/60">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-lg">{subject.name}</CardTitle>
                      {subject.code ? <Badge variant="outline">{subject.code}</Badge> : null}
                    </div>
                    {subject.description ? (
                      <CardDescription className="line-clamp-2">
                        {subject.description}
                      </CardDescription>
                    ) : null}
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>{subject.fileCount} archivos</span>
                    <span aria-hidden="true">·</span>
                    <span>{subject.conversationCount} conversaciones</span>
                    <span aria-hidden="true">·</span>
                    <span>{subject.documentCount} documentos</span>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
