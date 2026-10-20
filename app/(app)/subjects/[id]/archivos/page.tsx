import type { Metadata } from 'next'
import { FilesView, type FileRow } from '@/components/nodo/files-view'
import { listFiles } from '@/lib/data/queries'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Archivos' }

export default async function SubjectFilesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const files = await listFiles(user.id, id)

  const rows: FileRow[] = files.map((file) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    createdAt: file.createdAt.toISOString(),
  }))

  return <FilesView subjectId={id} files={rows} />
}
