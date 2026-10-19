import { FileUp, Files } from 'lucide-react'
import type { Metadata } from 'next'
import { DemoBadge } from '@/components/shared/demo-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { listFiles } from '@/lib/data/queries'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Archivos' }

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default async function FilesPage() {
  const user = await requireUser()
  const files = await listFiles(user.id)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Archivos"
        description="Tus apuntes, guías y parciales, asociados a cada materia."
        badge={<DemoBadge label="Subida no disponible" />}
        actions={
          <Button disabled>
            <FileUp data-icon="inline-start" />
            Subir archivo
          </Button>
        }
      />

      <Alert>
        <AlertTitle>La subida de archivos todavía no está activa</AlertTitle>
        <AlertDescription>
          Para guardar archivos hace falta conectar un almacenamiento (por ejemplo Vercel Blob).
          Mientras tanto podés usar materias, conversaciones, mapa de dudas y documentos.
        </AlertDescription>
      </Alert>

      {files.length === 0 ? (
        <EmptyState
          icon={Files}
          title="No hay archivos"
          description="Cuando la subida esté activa, vas a ver acá todo lo que cargues."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {files.map((file) => (
                <li key={file.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{file.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatSize(file.sizeBytes)} · {file.mimeType}
                    </span>
                  </div>
                  {file.subjectName ? <Badge variant="secondary">{file.subjectName}</Badge> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
