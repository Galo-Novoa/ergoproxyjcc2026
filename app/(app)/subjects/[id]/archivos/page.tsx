import { FileText } from 'lucide-react'
import type { Metadata } from 'next'
import { FileList } from '@/components/files/file-list'
import { FileUploadButton } from '@/components/files/file-upload-button'
import { EmptyState } from '@/components/shared/empty-state'
import { listFiles } from '@/lib/data/queries'
import { toFileItem } from '@/lib/files/view'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Archivos' }

export default async function SubjectFilesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const rows = await listFiles(user.id, id)
  const now = new Date()
  const files = rows.map((row) => toFileItem(row, now))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Archivos de la materia</h2>
          <p className="text-sm text-muted-foreground">
            Subí apuntes, guías y parciales en PDF. Extraemos su texto por página para que el tutor
            responda sobre tu material.
          </p>
        </div>
        <FileUploadButton subjectId={id} />
      </div>

      {files.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No hay archivos"
          description="Todavía no subiste material a esta materia."
        />
      ) : (
        <FileList files={files} />
      )}
    </div>
  )
}
