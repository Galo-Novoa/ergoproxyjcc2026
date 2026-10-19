import { Files } from 'lucide-react'
import type { Metadata } from 'next'
import { FileList } from '@/components/files/file-list'
import { FileUploadButton } from '@/components/files/file-upload-button'
import { DemoBadge } from '@/components/shared/demo-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { listFiles, listSubjects } from '@/lib/data/queries'
import { isDatabaseConfigured } from '@/lib/db/config'
import { toFileItem } from '@/lib/files/view'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Archivos' }

export default async function FilesPage() {
  const user = await requireUser()
  const [rows, subjects] = await Promise.all([listFiles(user.id), listSubjects(user.id)])
  const now = new Date()
  const files = rows.map((row) => toFileItem(row, now))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Archivos"
        description="Tus apuntes, guías y parciales en PDF, asociados a cada materia."
        badge={isDatabaseConfigured ? undefined : <DemoBadge label="Subida no disponible" />}
        actions={
          isDatabaseConfigured ? (
            <FileUploadButton
              subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))}
            />
          ) : undefined
        }
      />

      {files.length === 0 ? (
        <EmptyState
          icon={Files}
          title="No hay archivos"
          description="Subí un PDF: extraemos su texto por página y sugerimos si es teoría o práctica."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <FileList files={files} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
