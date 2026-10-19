import { ArrowLeft, FileUp, FileText, Files, Landmark } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { listGeneralDocuments, listGeneralFiles } from '@/lib/data/queries'
import { isDatabaseConfigured } from '@/lib/db/config'
import { formatRelative } from '@/lib/format'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'General' }

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default async function GeneralWorkspacePage() {
  const user = await requireUser()
  const [files, documents] = isDatabaseConfigured
    ? await Promise.all([listGeneralFiles(user.id), listGeneralDocuments(user.id)])
    : [[], []]
  const now = new Date()

  return (
    <div className="flex flex-col gap-2">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/">
          <ArrowLeft data-icon="inline-start" />
          Dashboard
        </Link>
      </Button>

      <PageHeader
        title="General"
        description="Documentación general de la facultad y archivos que todavía no pertenecen a ninguna materia."
        badge={<Badge variant="secondary">Workspace fijo</Badge>}
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
          Cuando esté disponible, lo que subas acá podrás moverlo a una materia más adelante.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 pt-2 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Files className="size-4" aria-hidden="true" /> Archivos sin materia
            </CardTitle>
            <CardDescription>{files.length} en total</CardDescription>
          </CardHeader>
          <CardContent>
            {files.length === 0 ? (
              <EmptyState
                icon={Landmark}
                title="Sin archivos"
                description="Reglamentos, calendarios y trámites de la facultad van a vivir acá."
              />
            ) : (
              <ul className="flex flex-col divide-y text-sm">
                {files.map((file) => (
                  <li key={file.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="truncate font-medium">{file.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatSize(file.sizeBytes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" aria-hidden="true" /> Documentos sin materia
            </CardTitle>
            <CardDescription>{documents.length} en total</CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Sin documentos"
                description="Las notas que crees sin elegir materia aparecen acá."
              >
                <Button asChild variant="outline">
                  <Link href="/documents/new">Crear documento</Link>
                </Button>
              </EmptyState>
            ) : (
              <ul className="flex flex-col divide-y text-sm">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-3 py-2">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="truncate font-medium underline-offset-4 hover:underline"
                    >
                      {doc.title}
                    </Link>
                    <span className="shrink-0 text-muted-foreground">
                      {formatRelative(doc.updatedAt, now)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
